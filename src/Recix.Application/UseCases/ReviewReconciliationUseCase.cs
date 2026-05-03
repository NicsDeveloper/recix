using Recix.Application.Interfaces;
using Recix.Application.Services;
using Recix.Domain.Entities;
using Recix.Domain.Enums;

namespace Recix.Application.UseCases;

/// <summary>
/// Processa a decisão humana sobre um resultado de conciliação que requer revisão.
///
/// Confirmar: o match de baixa confiança se torna definitivo (Matched).
///            A cobrança passa de PendingReview → Paid.
///
/// Rejeitar:  o match é descartado. A cobrança volta a Pending.
///            O PaymentEvent é recolocado em fila para novo matching (ou PaymentWithoutCharge).
/// </summary>
public sealed class ReviewReconciliationUseCase(
    IReconciliationRepository reconciliations,
    IChargeRepository charges,
    IPaymentEventRepository paymentEvents,
    ChargeBalanceApplier chargeBalanceApplier,
    IEventBroadcaster broadcaster)
{
    public async Task ConfirmAsync(Guid resultId, Guid reviewerUserId, Guid orgId, CancellationToken ct = default)
    {
        var result = await reconciliations.GetByIdAsync(resultId, ct)
            ?? throw new KeyNotFoundException("Resultado de conciliação não encontrado.");

        if (result.OrganizationId != orgId)
            throw new UnauthorizedAccessException("Sem permissão para revisar este item.");

        if (!result.RequiresReview)
            throw new InvalidOperationException("Este resultado não está pendente de revisão.");

        // Confirma o resultado → status vira Matched
        result.Confirm(reviewerUserId);
        await reconciliations.UpdateAsync(result, ct);

        if (result.ChargeId is { } cid && result.PaymentEventId != Guid.Empty)
        {
            await reconciliations.AddPaymentAllocationAsync(
                PaymentAllocation.CreateRecognized(result.OrganizationId, cid, result.PaymentEventId, result.PaidAmount),
                ct);
            await chargeBalanceApplier.RecalculateAsync(cid, ct);
            broadcaster.Publish(RecixEvent.ChargeUpdated(cid, orgId));
        }

        broadcaster.Publish(RecixEvent.ReconciliationCreated(result.Id, orgId));
    }

    public async Task RejectAsync(Guid resultId, Guid reviewerUserId, Guid orgId, CancellationToken ct = default)
    {
        var result = await reconciliations.GetByIdAsync(resultId, ct)
            ?? throw new KeyNotFoundException("Resultado de conciliação não encontrado.");

        if (result.OrganizationId != orgId)
            throw new UnauthorizedAccessException("Sem permissão para revisar este item.");

        if (!result.RequiresReview)
            throw new InvalidOperationException("Este resultado não está pendente de revisão.");

        result.Reject(reviewerUserId);

        // Reverte a cobrança para Pending — ela está disponível para novo matching
        if (result.ChargeId.HasValue)
        {
            var charge = await charges.GetByIdAsync(result.ChargeId.Value, ct);
            if (charge?.Status == ChargeStatus.PendingReview)
            {
                charge.RevertToPending();
                await charges.UpdateAsync(charge, ct);
                broadcaster.Publish(RecixEvent.ChargeUpdated(charge.Id, orgId));
            }
        }

        // Recoloca o PaymentEvent em fila para nova tentativa de matching
        var paymentEvent = await paymentEvents.GetByIdAsync(result.PaymentEventId, ct);
        if (paymentEvent is not null)
        {
            paymentEvent.RequeueForReReconciliation();
            await paymentEvents.UpdateAsync(paymentEvent, ct);
        }

        // Remove o resultado rejeitado (o reprocessamento vai gerar um novo)
        await reconciliations.DeleteAsync(result.Id, ct);

        broadcaster.Publish(RecixEvent.ReconciliationCreated(result.Id, orgId));
    }
}
