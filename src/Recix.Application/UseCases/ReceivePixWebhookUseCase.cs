using System.Text.Json;
using Recix.Application.Exceptions;
using Microsoft.Extensions.Logging;
using Recix.Application.DTOs;
using Recix.Application.Interfaces;
using Recix.Application.Services;
using Recix.Domain.Entities;

namespace Recix.Application.UseCases;

public sealed class ReceivePixWebhookUseCase(
    IPaymentEventRepository events,
    ICurrentOrganization currentOrg,
    IChargeRepository charges,
    IPaymentProcessorWake processorWake,
    PaymentReliabilityMetrics metrics,
    ILogger<ReceivePixWebhookUseCase> logger)
{
    public async Task<ReceivePixWebhookResponse> ExecuteAsync(
        ReceivePixWebhookRequest request,
        CancellationToken cancellationToken = default)
    {
        var existing = await events.GetByEventIdAsync(request.EventId, cancellationToken);
        if (existing is not null)
        {
            metrics.IncrementDuplicates();
            logger.LogWarning("Duplicate webhook received: EventId={EventId}", request.EventId);
            return new ReceivePixWebhookResponse
            {
                Received = true,
                EventId  = request.EventId,
                Status   = "IgnoredDuplicate"
            };
        }

        // Webhooks reais (EfiBank) costumam vir sem org no JWT — resolvemos pela cobrança para SignalR e multi-tenant.
        var orgFromJwt = currentOrg.OrganizationId ?? Guid.Empty;
        var orgId      = await ResolveOrganizationIdAsync(request, orgFromJwt, cancellationToken);

        var rawPayload   = JsonSerializer.Serialize(request);
        var paymentEvent = PaymentEvent.Create(
            orgId,
            request.EventId,
            request.ExternalChargeId,
            request.ReferenceId,
            request.PaidAmount,
            request.PaidAt,
            request.Provider,
            rawPayload);

        try
        {
            await events.AddAsync(paymentEvent, cancellationToken);
            processorWake.Pulse();
        }
        catch (DuplicatePaymentEventException)
        {
            metrics.IncrementDuplicates();
            logger.LogWarning("Duplicate webhook received in race condition: EventId={EventId}", request.EventId);
            return new ReceivePixWebhookResponse
            {
                Received = true,
                EventId = request.EventId,
                Status = "IgnoredDuplicate"
            };
        }

        metrics.IncrementReceived();

        logger.LogInformation("Webhook received: EventId={EventId} Provider={Provider} Amount={Amount} OrgId={OrgId}",
            request.EventId, request.Provider, request.PaidAmount, paymentEvent.OrganizationId);

        return new ReceivePixWebhookResponse
        {
            Received = true,
            EventId  = request.EventId,
            Status   = "Received"
        };
    }

    /// <summary>Preenche org a partir da cobrança quando o webhook não traz contexto de organização.</summary>
    private async Task<Guid> ResolveOrganizationIdAsync(
        ReceivePixWebhookRequest request,
        Guid organizationIdFromContext,
        CancellationToken ct)
    {
        if (organizationIdFromContext != Guid.Empty)
            return organizationIdFromContext;

        if (!string.IsNullOrWhiteSpace(request.ExternalChargeId))
        {
            var byExt = await charges.GetByExternalIdAsync(request.ExternalChargeId, ct);
            if (byExt is not null)
                return byExt.OrganizationId;
        }

        if (!string.IsNullOrWhiteSpace(request.ReferenceId))
        {
            var byRef = await charges.GetByReferenceIdAsync(request.ReferenceId, ct);
            if (byRef is not null)
                return byRef.OrganizationId;
        }

        return Guid.Empty;
    }
}
