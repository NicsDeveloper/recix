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

        // Webhooks reais (EfiBank) usam contexto de sistema — todos os orgs
        // Webhooks via simulador usam o org do usuário autenticado
        var orgId = currentOrg.OrganizationId ?? Guid.Empty;   // Guid.Empty = webhook sem contexto de org (ex: EfiBank real)

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
            request.EventId, request.Provider, request.PaidAmount, orgId);

        return new ReceivePixWebhookResponse
        {
            Received = true,
            EventId  = request.EventId,
            Status   = "Received"
        };
    }
}
