using Recix.Application.Interfaces;
using Recix.Domain.Entities;
using Recix.Domain.Enums;

namespace Recix.Application.Services;

public sealed record ReconciliationOutcome(ReconciliationResult Result, Charge? Charge);

/// <summary>
/// Estratégia de matching (em ordem decrescente de confiança):
///   1. ExternalChargeId exato           → HIGH confidence
///   2. ReferenceId exato                → HIGH confidence
///   3. Valor + janela ±48h, 1 candidato → MEDIUM confidence (RequiresReview)
///   4. Valor + FIFO, 1 candidato        → LOW confidence   (RequiresReview)
///   Múltiplos candidatos em 3 ou 4      → MultipleMatchCandidates (RequiresReview)
///   ReferenceId informado mas não existe → InvalidReference (sem fallback)
///
/// Com identificador exato, o valor é resolvido por saldo: soma dos pagamentos já alocados
/// vs valor esperado da cobrança (pagamento parcial, conciliação cumulativa, excedente).
/// </summary>
public sealed class ReconciliationEngine
{
    private static readonly TimeSpan MatchWindow = TimeSpan.FromHours(48);

    private readonly IChargeRepository          _charges;
    private readonly IReconciliationRepository _reconciliations;

    public ReconciliationEngine(IChargeRepository charges, IReconciliationRepository reconciliations)
    {
        _charges         = charges;
        _reconciliations = reconciliations;
    }

    public async Task<ReconciliationOutcome> ReconcileAsync(
        PaymentEvent paymentEvent,
        CancellationToken ct = default)
    {
        var match = await FindMatchAsync(paymentEvent, ct);
        return await BuildOutcomeAsync(paymentEvent, match, ct);
    }

    // ── Lookup ──────────────────────────────────────────────────────────────────

    private async Task<MatchResult> FindMatchAsync(PaymentEvent evt, CancellationToken ct)
    {
        // 1. ExternalChargeId — se informado, tenta; não faz fallback se não achar
        if (!string.IsNullOrWhiteSpace(evt.ExternalChargeId))
        {
            var c = await _charges.GetByExternalIdAsync(evt.ExternalChargeId, ct);
            return c is not null
                ? MatchResult.Found(c, ConfidenceLevel.High, MatchReason.ExactExternalChargeId, "ExternalChargeId")
                : MatchResult.NotFound(MatchReason.InvalidReference);
        }

        // 2. ReferenceId — se informado, tenta; não faz fallback se não achar
        if (!string.IsNullOrWhiteSpace(evt.ReferenceId))
        {
            var c = await _charges.GetByReferenceIdAsync(evt.ReferenceId, ct);
            return c is not null
                ? MatchResult.Found(c, ConfidenceLevel.High, MatchReason.ExactReferenceId, "ReferenceId")
                : MatchResult.NotFound(MatchReason.InvalidReference);
        }

        // Sem identificador — só tenta fuzzy se há contexto de organização
        if (evt.OrganizationId == Guid.Empty)
            return MatchResult.NotFound(MatchReason.NoMatch);

        // 3. Valor + janela temporal ±48h
        var from   = evt.PaidAt - MatchWindow;
        var to     = evt.PaidAt + MatchWindow;
        var window = await _charges.FindPendingByAmountAndDateRangeAsync(
            evt.PaidAmount, evt.OrganizationId, from, to, ct);

        if (window.Count == 1)
            return MatchResult.Found(window[0], ConfidenceLevel.Medium, MatchReason.ValueWithinTimeWindow, "Value+Date");

        if (window.Count > 1)
            return MatchResult.Multiple(window, MatchReason.ValueWithinTimeWindow);

        // 4. Valor + FIFO (sem janela)
        var fifo = await _charges.FindPendingByAmountAsync(evt.PaidAmount, evt.OrganizationId, ct);

        if (fifo.Count == 1)
            return MatchResult.Found(fifo[0], ConfidenceLevel.Low, MatchReason.ValueFifo, "Value+FIFO");

        if (fifo.Count > 1)
            return MatchResult.Multiple(fifo, MatchReason.ValueFifo);

        return MatchResult.NotFound(MatchReason.NoMatch);
    }

    // ── Build outcome ────────────────────────────────────────────────────────────

    private async Task<ReconciliationOutcome> BuildOutcomeAsync(
        PaymentEvent evt,
        MatchResult match,
        CancellationToken ct)
    {
        var orgId = evt.OrganizationId;

        // ── Sem candidato ─────────────────────────────────────────────────────────
        if (match.Charge is null && match.Candidates.Count == 0)
        {
            var noMatchStatus = match.Reason == MatchReason.InvalidReference
                ? ReconciliationStatus.InvalidReference
                : ReconciliationStatus.PaymentWithoutCharge;

            var noMatchReason = match.Reason == MatchReason.InvalidReference
                ? "Identificador informado não corresponde a nenhuma cobrança no sistema."
                : "Nenhuma cobrança pendente encontrada para este pagamento.";

            return new ReconciliationOutcome(
                ReconciliationResult.Create(orgId, null, evt.Id, noMatchStatus, noMatchReason,
                    null, evt.PaidAmount, ConfidenceLevel.High, match.Reason),
                null);
        }

        // ── Múltiplos candidatos — requer escolha humana ──────────────────────────
        if (match.Candidates.Count > 1)
        {
            var candidateIds = string.Join(", ", match.Candidates.Take(5).Select(c => c.ReferenceId));
            return new ReconciliationOutcome(
                ReconciliationResult.Create(
                    orgId, null, evt.Id,
                    ReconciliationStatus.MultipleMatchCandidates,
                    $"Múltiplos candidatos ({match.Candidates.Count}) com valor R${evt.PaidAmount:F2}: {candidateIds}.",
                    null, evt.PaidAmount,
                    match.Confidence, match.Reason, match.MatchedField),
                null);
        }

        var charge = match.Charge!;

        // ── Cobrança já liquidada (paga ou excedente consolidado) ──────────────────
        if (charge.Status is ChargeStatus.Paid or ChargeStatus.Overpaid)
        {
            return new ReconciliationOutcome(
                ReconciliationResult.Create(
                    orgId, charge.Id, evt.Id,
                    ReconciliationStatus.DuplicatePayment,
                    "Cobrança já liquidada. Este pagamento é duplicado ou excedente.",
                    charge.Amount, evt.PaidAmount,
                    ConfidenceLevel.High, match.Reason, match.MatchedField),
                null);
        }

        // ── Cobrança em PendingReview (reservada por outro match de baixa confiança)
        if (charge.Status == ChargeStatus.PendingReview)
        {
            if (match.Confidence != ConfidenceLevel.High)
            {
                return new ReconciliationOutcome(
                    ReconciliationResult.Create(
                        orgId, charge.Id, evt.Id,
                        ReconciliationStatus.DuplicatePayment,
                        "Cobrança já reservada por outro match em análise.",
                        charge.Amount, evt.PaidAmount,
                        ConfidenceLevel.High, match.Reason, match.MatchedField),
                    null);
            }

            await _reconciliations.AbandonPendingReviewForChargeAsync(charge.Id, ct);
            charge.RevertToPending();
        }

        // ── Cobrança expirada ─────────────────────────────────────────────────────
        if (charge.IsExpired())
        {
            charge.MarkAsDivergent();
            return new ReconciliationOutcome(
                ReconciliationResult.Create(
                    orgId, charge.Id, evt.Id,
                    ReconciliationStatus.ExpiredChargePaid,
                    $"Cobrança expirou em {charge.ExpiresAt:dd/MM/yyyy HH:mm} e recebeu pagamento após o prazo.",
                    charge.Amount, evt.PaidAmount,
                    match.Confidence, MatchReason.FoundButExpired, match.MatchedField),
                charge);
        }

        // ── Match de baixa/média confiança — reserva para revisão (valor = cobrança) ─
        if (match.Confidence is ConfidenceLevel.Low or ConfidenceLevel.Medium)
        {
            if (evt.PaidAmount != charge.Amount)
            {
                charge.MarkAsDivergent();
                var delta = evt.PaidAmount - charge.Amount;
                return new ReconciliationOutcome(
                    ReconciliationResult.Create(
                        orgId, charge.Id, evt.Id,
                        ReconciliationStatus.AmountMismatch,
                        $"Match fuzzy exige valor igual ao da cobrança. Pago R${evt.PaidAmount:F2} vs cobrança R${charge.Amount:F2} (delta: {delta:+0.00;-0.00}).",
                        charge.Amount, evt.PaidAmount,
                        match.Confidence, MatchReason.FoundWithAmountMismatch, match.MatchedField),
                    charge);
            }

            charge.MarkAsPendingReview();
            return new ReconciliationOutcome(
                ReconciliationResult.Create(
                    orgId, charge.Id, evt.Id,
                    ReconciliationStatus.MatchedLowConfidence,
                    $"Match por {match.MatchedField} sem identificador único. Aguarda confirmação humana.",
                    charge.Amount, evt.PaidAmount,
                    match.Confidence, match.Reason, match.MatchedField),
                charge);
        }

        // ── Alta confiança: saldo = esperado − soma dos pagamentos já alocados ─────
        var allocatedBefore = await _reconciliations.SumAllocatedTowardChargeAsync(charge.Id, ct);
        var remaining       = charge.Amount - allocatedBefore;

        if (remaining <= 0)
        {
            return new ReconciliationOutcome(
                ReconciliationResult.Create(
                    orgId, charge.Id, evt.Id,
                    ReconciliationStatus.DuplicatePayment,
                    "A soma dos pagamentos já cobre o valor esperado desta cobrança. Este evento é duplicado ou excedente.",
                    charge.Amount, evt.PaidAmount,
                    ConfidenceLevel.High, match.Reason, match.MatchedField),
                null);
        }

        var newTotal = allocatedBefore + evt.PaidAmount;

        if (newTotal < charge.Amount)
        {
            charge.MarkAsPartiallyPaid();
            var stillOwed = charge.Amount - newTotal;
            return new ReconciliationOutcome(
                ReconciliationResult.Create(
                    orgId, charge.Id, evt.Id,
                    ReconciliationStatus.PartialPayment,
                    $"Parcialmente pago — total recebido R${newTotal:F2} de R${charge.Amount:F2}; faltam R${stillOwed:F2}.",
                    charge.Amount, evt.PaidAmount,
                    ConfidenceLevel.High, match.Reason, match.MatchedField),
                charge);
        }

        if (newTotal == charge.Amount)
        {
            charge.MarkAsPaid();
            var reasonText = allocatedBefore > 0
                ? $"Conciliado por soma de pagamentos — total recebido R${newTotal:F2}."
                : "Pagamento conciliado com sucesso.";
            var matchReason = allocatedBefore > 0 ? MatchReason.CumulativeSettlement : match.Reason;
            return new ReconciliationOutcome(
                ReconciliationResult.Create(
                    orgId, charge.Id, evt.Id,
                    ReconciliationStatus.Matched,
                    reasonText,
                    charge.Amount, evt.PaidAmount,
                    ConfidenceLevel.High, matchReason, match.MatchedField),
                charge);
        }

        charge.MarkAsOverpaid();
        var excess = newTotal - charge.Amount;
        return new ReconciliationOutcome(
            ReconciliationResult.Create(
                orgId, charge.Id, evt.Id,
                ReconciliationStatus.PaymentExceedsExpected,
                $"Pagamento excede o valor esperado. Saldo pendente antes deste evento: R${remaining:F2}; " +
                $"com R${evt.PaidAmount:F2} o total ultrapassa em R${excess:F2}.",
                charge.Amount, evt.PaidAmount,
                ConfidenceLevel.High, MatchReason.PaymentExceedsBalance, match.MatchedField),
            charge);
    }

    // ── Value object interno ──────────────────────────────────────────────────

    private sealed record MatchResult
    {
        public Charge?               Charge       { get; init; }
        public IReadOnlyList<Charge> Candidates   { get; init; } = [];
        public ConfidenceLevel       Confidence   { get; init; }
        public MatchReason           Reason       { get; init; }
        public string?               MatchedField { get; init; }

        public static MatchResult Found(Charge charge, ConfidenceLevel confidence, MatchReason reason, string field)
            => new() { Charge = charge, Confidence = confidence, Reason = reason, MatchedField = field };

        public static MatchResult Multiple(IReadOnlyList<Charge> candidates, MatchReason reason)
            => new() { Candidates = candidates, Confidence = ConfidenceLevel.Low, Reason = reason };

        public static MatchResult NotFound(MatchReason reason)
            => new() { Confidence = ConfidenceLevel.High, Reason = reason };
    }
}
