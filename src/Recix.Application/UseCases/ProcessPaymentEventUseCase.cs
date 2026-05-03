using Microsoft.Extensions.Logging;
using Recix.Application.Interfaces;
using Recix.Application.Services;
using Recix.Domain.Entities;
using Recix.Domain.Enums;

namespace Recix.Application.UseCases;

public sealed class ProcessPaymentEventUseCase
{
    private readonly IPaymentEventRepository _events;
    private readonly IChargeRepository _charges;
    private readonly IReconciliationRepository _reconciliations;
    private readonly ReconciliationEngine _engine;
    private readonly ChargeBalanceApplier _chargeBalanceApplier;
    private readonly PaymentReliabilityMetrics _metrics;
    private readonly IEventBroadcaster _broadcaster;
    private readonly IAlertNotifier _alertNotifier;
    private readonly ILogger<ProcessPaymentEventUseCase> _logger;

    public ProcessPaymentEventUseCase(
        IPaymentEventRepository events,
        IChargeRepository charges,
        IReconciliationRepository reconciliations,
        ReconciliationEngine engine,
        ChargeBalanceApplier chargeBalanceApplier,
        PaymentReliabilityMetrics metrics,
        IEventBroadcaster broadcaster,
        IAlertNotifier alertNotifier,
        ILogger<ProcessPaymentEventUseCase> logger)
    {
        _events          = events;
        _charges         = charges;
        _reconciliations      = reconciliations;
        _engine               = engine;
        _chargeBalanceApplier = chargeBalanceApplier;
        _metrics              = metrics;
        _broadcaster     = broadcaster;
        _alertNotifier   = alertNotifier;
        _logger          = logger;
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

            if (outcome.Allocation is { } ins)
            {
                await _reconciliations.AddPaymentAllocationAsync(
                    PaymentAllocation.CreateRecognized(
                        paymentEvent.OrganizationId,
                        ins.ChargeId,
                        ins.PaymentEventId,
                        ins.Amount),
                    cancellationToken);
            }

            var chargeId = outcome.Result.ChargeId ?? outcome.Charge?.Id;
            if (chargeId.HasValue)
            {
                if (outcome.Result.Status == ReconciliationStatus.ExpiredChargePaid)
                {
                    // Engine applied MarkAsDivergent() in memory; persist without calling ChargeBalanceApplier,
                    // which would incorrectly transition an expired charge to Paid when sum == amount.
                    if (outcome.Charge is { } expiredCharge)
                        await _charges.UpdateAsync(expiredCharge, cancellationToken);
                }
                else
                {
                    await _chargeBalanceApplier.RecalculateAsync(chargeId.Value, cancellationToken);
                }

                _broadcaster.Publish(RecixEvent.ChargeUpdated(chargeId.Value, paymentEvent.OrganizationId));
            }

            paymentEvent.MarkAsProcessed();
            await _events.UpdateAsync(paymentEvent, cancellationToken);
            _broadcaster.Publish(RecixEvent.ReconciliationCreated(outcome.Result.Id, paymentEvent.OrganizationId));
            _broadcaster.Publish(RecixEvent.PaymentEventUpdated(paymentEvent.Id, paymentEvent.OrganizationId));
            _metrics.IncrementProcessed();

            _logger.LogInformation(
                "PaymentEvent {PaymentEventId} reconciled as {Status}",
                paymentEvent.Id, outcome.Result.Status);

            // MatchedLowConfidence vai para a fila de revisão, não é alerta de erro.
            // MultipleMatchCandidates também vai para revisão — usuário seleciona o candidato.
            var isReviewItem = outcome.Result.Status is ReconciliationStatus.MatchedLowConfidence
                                                     or ReconciliationStatus.MultipleMatchCandidates;

            if (isReviewItem)
                _broadcaster.Publish(RecixEvent.PendingReviewCreated(outcome.Result.Id, paymentEvent.OrganizationId));

            // Notificação proativa de divergências (best-effort, nunca bloqueia)
            if (!isReviewItem
                && outcome.Result.Status is not ReconciliationStatus.Matched
                && outcome.Result.Status is not ReconciliationStatus.PartialPayment)
            {
                await _alertNotifier.NotifyAsync(
                    orgId:          paymentEvent.OrganizationId,
                    status:         outcome.Result.Status,
                    chargeId:       outcome.Result.ChargeId,
                    paymentEventId: paymentEvent.Id,
                    expectedAmount: outcome.Result.ExpectedAmount,
                    paidAmount:     outcome.Result.PaidAmount,
                    reason:         outcome.Result.Reason,
                    ct:             cancellationToken);
            }
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
