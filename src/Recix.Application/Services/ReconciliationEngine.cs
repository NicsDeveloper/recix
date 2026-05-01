using Recix.Application.Interfaces;
using Recix.Domain.Entities;
using Recix.Domain.Enums;

namespace Recix.Application.Services;

public sealed record ReconciliationOutcome(ReconciliationResult Result, Charge? Charge);

public sealed class ReconciliationEngine
{
    private readonly IChargeRepository _charges;

    public ReconciliationEngine(IChargeRepository charges) => _charges = charges;

    public async Task<ReconciliationOutcome> ReconcileAsync(PaymentEvent paymentEvent, CancellationToken cancellationToken = default)
    {
        var charge = await FindChargeAsync(paymentEvent, cancellationToken);

        if (charge is null)
        {
            var status = DetermineNoChargeStatus(paymentEvent);
            var reason = status == ReconciliationStatus.InvalidReference
                ? "Sem identificador de cobrança e sem cobranças pendentes com este valor para correspondência automática."
                : "Nenhuma cobrança encontrada para este pagamento.";

            var result = ReconciliationResult.Create(
                paymentEvent.OrganizationId,
                null, paymentEvent.Id,
                status, reason,
                null, paymentEvent.PaidAmount);

            return new ReconciliationOutcome(result, null);
        }

        var orgId = paymentEvent.OrganizationId;

        // Duplicate: charge already settled
        if (charge.Status == ChargeStatus.Paid || charge.Status == ChargeStatus.Divergent)
        {
            var result = ReconciliationResult.Create(
                orgId, charge.Id, paymentEvent.Id,
                ReconciliationStatus.DuplicatePayment,
                $"Cobrança já está com status {charge.Status}. Pagamento duplicado ignorado.",
                charge.Amount, paymentEvent.PaidAmount);

            return new ReconciliationOutcome(result, null);
        }

        // Expired charge (takes priority over amount check)
        if (charge.IsExpired())
        {
            charge.MarkAsDivergent();
            var result = ReconciliationResult.Create(
                orgId, charge.Id, paymentEvent.Id,
                ReconciliationStatus.ExpiredChargePaid,
                $"Cobrança expirou em {charge.ExpiresAt:O}. Pagamento recebido após o prazo.",
                charge.Amount, paymentEvent.PaidAmount);

            return new ReconciliationOutcome(result, charge);
        }

        // Amount mismatch
        if (paymentEvent.PaidAmount != charge.Amount)
        {
            charge.MarkAsDivergent();
            var result = ReconciliationResult.Create(
                orgId, charge.Id, paymentEvent.Id,
                ReconciliationStatus.AmountMismatch,
                $"Valor pago {paymentEvent.PaidAmount:F2} diverge do esperado {charge.Amount:F2}.",
                charge.Amount, paymentEvent.PaidAmount);

            return new ReconciliationOutcome(result, charge);
        }

        // Happy path: matched
        charge.MarkAsPaid();
        var matched = ReconciliationResult.Create(
            orgId, charge.Id, paymentEvent.Id,
            ReconciliationStatus.Matched,
            "Pagamento conciliado com sucesso.",
            charge.Amount, paymentEvent.PaidAmount);

        return new ReconciliationOutcome(matched, charge);
    }

    // ── Lookup ──────────────────────────────────────────────────────────────────

    private async Task<Charge?> FindChargeAsync(PaymentEvent paymentEvent, CancellationToken ct)
    {
        // 1. Exact match by ExternalChargeId
        if (!string.IsNullOrWhiteSpace(paymentEvent.ExternalChargeId))
        {
            var c = await _charges.GetByExternalIdAsync(paymentEvent.ExternalChargeId, ct);
            if (c is not null) return c;
        }

        // 2. Exact match by ReferenceId
        if (!string.IsNullOrWhiteSpace(paymentEvent.ReferenceId))
        {
            var c = await _charges.GetByReferenceIdAsync(paymentEvent.ReferenceId, ct);
            if (c is not null) return c;
        }

        // 3. Fuzzy match by amount (only when org is known and no identifier was provided)
        //    Usada quando o extrato bancário (OFX/CSV) não carrega referência da venda.
        //    Pega a cobrança pendente mais antiga com o mesmo valor (FIFO).
        if (paymentEvent.OrganizationId != Guid.Empty)
        {
            var candidates = await _charges.FindPendingByAmountAsync(
                paymentEvent.PaidAmount, paymentEvent.OrganizationId, ct);

            if (candidates.Count > 0)
                return candidates[0]; // FIFO: oldest pending charge with same amount
        }

        return null;
    }

    private static ReconciliationStatus DetermineNoChargeStatus(PaymentEvent paymentEvent)
    {
        // Se havia identificador mas não encontrou cobrança → PaymentWithoutCharge
        if (!string.IsNullOrWhiteSpace(paymentEvent.ExternalChargeId) ||
            !string.IsNullOrWhiteSpace(paymentEvent.ReferenceId))
            return ReconciliationStatus.PaymentWithoutCharge;

        // Sem identificador e sem org → não foi possível tentar fuzzy
        if (paymentEvent.OrganizationId == Guid.Empty)
            return ReconciliationStatus.InvalidReference;

        // Tinha org, tentou fuzzy, não achou → pagamento sem cobrança correspondente
        return ReconciliationStatus.PaymentWithoutCharge;
    }
}
