using Recix.Application.Interfaces;
using Recix.Domain.Entities;
using Recix.Domain.Enums;

namespace Recix.Application.Services;

public sealed record PaymentAllocationInstruction(
    Guid ChargeId,
    Guid PaymentEventId,
    decimal Amount,
    AllocationRecognition Recognition);

public sealed record ReconciliationOutcome(
    ReconciliationResult Result,
    Charge? Charge,
    PaymentAllocationInstruction? Allocation);

/// <summary>
/// Estratégia de matching (em ordem decrescente de confiança):
///   1. ExternalChargeId exato           → HIGH confidence
///   2. ReferenceId exato                → HIGH confidence
///   3. Valor + janela ±48h, 1 candidato → MEDIUM confidence (RequiresReview)
///   4. Valor + FIFO, 1 candidato        → LOW confidence   (RequiresReview)
///   Múltiplos candidatos em 3 ou 4      → MultipleMatchCandidates (RequiresReview)
///
/// Se <see cref="PaymentEvent.ExternalChargeId"/> não encontrar cobrança, tenta
/// <see cref="PaymentEvent.ReferenceId"/> e depois fuzzy (quando há OrganizationId).
/// Sem organização, identificadores informados e não encontrados retornam InvalidReference.
///
/// Cobrança em PendingReview é liberada (abandona revisão + volta a Pending) e o fluxo continua —
/// não bloqueia novos matches nem trata como duplicado por estar em revisão.
///
/// Com identificador exato, o valor é resolvido por saldo: soma dos valores já alocados
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
        if (!string.IsNullOrWhiteSpace(evt.ExternalChargeId))
        {
            var byExt = await _charges.GetByExternalIdAsync(evt.ExternalChargeId, ct);
            if (byExt is not null)
                return MatchResult.Found(byExt, ConfidenceLevel.High, MatchReason.ExactExternalChargeId, "ExternalChargeId");
        }

        if (!string.IsNullOrWhiteSpace(evt.ReferenceId))
        {
            var byRef = await _charges.GetByReferenceIdAsync(evt.ReferenceId, ct);
            if (byRef is not null)
                return MatchResult.Found(byRef, ConfidenceLevel.High, MatchReason.ExactReferenceId, "ReferenceId");
        }

        if (evt.OrganizationId == Guid.Empty)
        {
            if (!string.IsNullOrWhiteSpace(evt.ExternalChargeId))
                return MatchResult.NotFound(MatchReason.InvalidReference);
            if (!string.IsNullOrWhiteSpace(evt.ReferenceId))
                return MatchResult.NotFound(MatchReason.InvalidReference);

            return MatchResult.NotFound(MatchReason.NoMatch);
        }

        var from   = evt.PaidAt - MatchWindow;
        var to     = evt.PaidAt + MatchWindow;
        var window = await _charges.FindPendingByAmountAndDateRangeAsync(
            evt.PaidAmount, evt.OrganizationId, from, to, ct);

        if (window.Count == 1)
            return MatchResult.Found(window[0], ConfidenceLevel.Medium, MatchReason.ValueWithinTimeWindow, "Value+Date");

        if (window.Count > 1)
            return MatchResult.Multiple(window, MatchReason.ValueWithinTimeWindow);

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
                null,
                null);
        }

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
                null,
                null);
        }

        var charge = match.Charge!;

        if (charge.Status == ChargeStatus.PendingReview)
        {
            await _reconciliations.AbandonPendingReviewForChargeAsync(charge.Id, ct);
            charge.RevertToPending();
        }

        if (charge.Status is ChargeStatus.Paid or ChargeStatus.Overpaid)
        {
            return new ReconciliationOutcome(
                ReconciliationResult.Create(
                    orgId, charge.Id, evt.Id,
                    ReconciliationStatus.DuplicatePayment,
                    "Cobrança já liquidada. Este pagamento é duplicado ou excedente.",
                    charge.Amount, evt.PaidAmount,
                    ConfidenceLevel.High, match.Reason, match.MatchedField),
                null,
                null);
        }

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
                charge,
                new PaymentAllocationInstruction(charge.Id, evt.Id, evt.PaidAmount, AllocationRecognition.Recognized));
        }

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
                    charge,
                    new PaymentAllocationInstruction(charge.Id, evt.Id, evt.PaidAmount, AllocationRecognition.Recognized));
            }

            charge.MarkAsPendingReview();
            return new ReconciliationOutcome(
                ReconciliationResult.Create(
                    orgId, charge.Id, evt.Id,
                    ReconciliationStatus.MatchedLowConfidence,
                    $"Match por {match.MatchedField} sem identificador único. Aguarda confirmação humana.",
                    charge.Amount, evt.PaidAmount,
                    match.Confidence, match.Reason, match.MatchedField),
                charge,
                null);
        }

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
                null,
                null);
        }

        var newTotal = allocatedBefore + evt.PaidAmount;
        var allocAmt = Math.Min(evt.PaidAmount, remaining);
        var allocation = new PaymentAllocationInstruction(
            charge.Id, evt.Id, allocAmt, AllocationRecognition.Recognized);

        if (newTotal < charge.Amount)
        {
            var stillOwed = charge.Amount - newTotal;
            return new ReconciliationOutcome(
                ReconciliationResult.Create(
                    orgId, charge.Id, evt.Id,
                    ReconciliationStatus.PartialPayment,
                    $"Parcialmente pago — total recebido R${newTotal:F2} de R${charge.Amount:F2}; faltam R${stillOwed:F2}.",
                    charge.Amount, evt.PaidAmount,
                    ConfidenceLevel.High, match.Reason, match.MatchedField),
                charge,
                allocation);
        }

        if (newTotal == charge.Amount)
        {
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
                charge,
                allocation);
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
            charge,
            allocation);
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
