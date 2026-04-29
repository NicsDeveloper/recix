using System.Text.Json;
using Microsoft.Extensions.Logging;
using Recix.Application.DTOs;
using Recix.Application.Interfaces;
using Recix.Domain.Entities;

namespace Recix.Application.UseCases;

public sealed class ReceivePixWebhookUseCase
{
    private readonly IPaymentEventRepository _events;
    private readonly ILogger<ReceivePixWebhookUseCase> _logger;

    public ReceivePixWebhookUseCase(IPaymentEventRepository events, ILogger<ReceivePixWebhookUseCase> logger)
    {
        _events = events;
        _logger = logger;
    }

    public async Task<ReceivePixWebhookResponse> ExecuteAsync(ReceivePixWebhookRequest request, CancellationToken cancellationToken = default)
    {
        var existing = await _events.GetByEventIdAsync(request.EventId, cancellationToken);
        if (existing is not null)
        {
            _logger.LogWarning("Duplicate webhook received: EventId={EventId}", request.EventId);
            return new ReceivePixWebhookResponse
            {
                Received = true,
                EventId = request.EventId,
                Status = "IgnoredDuplicate"
            };
        }

        var rawPayload = JsonSerializer.Serialize(request);
        var paymentEvent = PaymentEvent.Create(
            request.EventId,
            request.ExternalChargeId,
            request.ReferenceId,
            request.PaidAmount,
            request.PaidAt,
            request.Provider,
            rawPayload);

        await _events.AddAsync(paymentEvent, cancellationToken);

        _logger.LogInformation("Webhook received: EventId={EventId} Provider={Provider} Amount={Amount}",
            request.EventId, request.Provider, request.PaidAmount);

        return new ReceivePixWebhookResponse
        {
            Received = true,
            EventId = request.EventId,
            Status = "Received"
        };
    }
}
