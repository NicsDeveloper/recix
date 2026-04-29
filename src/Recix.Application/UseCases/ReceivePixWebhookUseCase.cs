using System.Text.Json;
using Microsoft.Extensions.Logging;
using Recix.Application.DTOs;
using Recix.Application.Interfaces;
using Recix.Domain.Entities;

namespace Recix.Application.UseCases;

public sealed class ReceivePixWebhookUseCase(
    IPaymentEventRepository events,
    ICurrentOrganization currentOrg,
    ILogger<ReceivePixWebhookUseCase> logger)
{
    public async Task<ReceivePixWebhookResponse> ExecuteAsync(
        ReceivePixWebhookRequest request,
        CancellationToken cancellationToken = default)
    {
        var existing = await events.GetByEventIdAsync(request.EventId, cancellationToken);
        if (existing is not null)
        {
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

        await events.AddAsync(paymentEvent, cancellationToken);

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
