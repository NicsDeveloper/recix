using Microsoft.Extensions.Logging;
using Recix.Application.Interfaces;
using Recix.Application.Services;
using Recix.Domain.Enums;

namespace Recix.Application.UseCases;

public sealed class ProcessPaymentEventUseCase
{
    private readonly IPaymentEventRepository _events;
    private readonly IChargeRepository _charges;
    private readonly IReconciliationRepository _reconciliations;
    private readonly ReconciliationEngine _engine;
    private readonly PaymentReliabilityMetrics _metrics;
    private readonly ILogger<ProcessPaymentEventUseCase> _logger;

    public ProcessPaymentEventUseCase(
        IPaymentEventRepository events,
        IChargeRepository charges,
        IReconciliationRepository reconciliations,
        ReconciliationEngine engine,
        PaymentReliabilityMetrics metrics,
        ILogger<ProcessPaymentEventUseCase> logger)
    {
        _events = events;
        _charges = charges;
        _reconciliations = reconciliations;
        _engine = engine;
        _metrics = metrics;
        _logger = logger;
    }

    public async Task ExecuteAsync(Guid paymentEventId, CancellationToken cancellationToken = default)
    {
        var paymentEvent = await _events.GetByIdAsync(paymentEventId, cancellationToken);
        if (paymentEvent is null)
        {
            _logger.LogWarning("PaymentEvent not found: {PaymentEventId}", paymentEventId);
            return;
        }

        _logger.LogInformation("Processing PaymentEvent {PaymentEventId} EventId={EventId}",
            paymentEvent.Id, paymentEvent.EventId);

        if (paymentEvent.Status is PaymentEventStatus.Processed or PaymentEventStatus.IgnoredDuplicate)
        {
            _logger.LogInformation(
                "Skipping PaymentEvent {PaymentEventId} because status is {Status}.",
                paymentEvent.Id,
                paymentEvent.Status);
            return;
        }

        paymentEvent.MarkAsProcessing();
        await _events.UpdateAsync(paymentEvent, cancellationToken);

        try
        {
            var outcome = await _engine.ReconcileAsync(paymentEvent, cancellationToken);

            await _reconciliations.AddAsync(outcome.Result, cancellationToken);

            if (outcome.Charge is not null)
                await _charges.UpdateAsync(outcome.Charge, cancellationToken);

            paymentEvent.MarkAsProcessed();
            await _events.UpdateAsync(paymentEvent, cancellationToken);
            _metrics.IncrementProcessed();

            _logger.LogInformation(
                "PaymentEvent {PaymentEventId} reconciled as {Status}",
                paymentEvent.Id, outcome.Result.Status);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to process PaymentEvent {PaymentEventId}", paymentEvent.Id);
            paymentEvent.MarkAsFailed();
            await _events.UpdateAsync(paymentEvent, cancellationToken);
            _metrics.IncrementFailed();
        }
    }
}
