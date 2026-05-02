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
/// </summary>
public sealed class ReconciliationEngine
{
    private static readonly TimeSpan MatchWindow = TimeSpan.FromHours(48);

    private readonly IChargeRepository _charges;

    public ReconciliationEngine(IChargeRepository charges) => _charges = charges;

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

    private static async Task<ReconciliationOutcome> BuildOutcomeAsync(
        PaymentEvent evt,
        MatchResult match,
        CancellationToken _)
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

        // ── Cobrança já conciliada com alta confiança — duplicata definitiva ───────
        if (charge.Status == ChargeStatus.Paid)
        {
            return new ReconciliationOutcome(
                ReconciliationResult.Create(
                    orgId, charge.Id, evt.Id,
                    ReconciliationStatus.DuplicatePayment,
                    "Cobrança já conciliada. Este pagamento é duplicado.",
                    charge.Amount, evt.PaidAmount,
                    ConfidenceLevel.High, match.Reason, match.MatchedField),
                null);
        }

        // ── Cobrança em PendingReview (reservada por outro match de baixa confiança)
        if (charge.Status == ChargeStatus.PendingReview)
        {
            // Match por ID exato supera a reserva prévia
            if (match.Confidence == ConfidenceLevel.High)
            {
                charge.MarkAsPaid();
                return new ReconciliationOutcome(
                    ReconciliationResult.Create(
                        orgId, charge.Id, evt.Id,
                        ReconciliationStatus.Matched,
                        "Conciliado por identificador exato, substituindo match anterior de baixa confiança.",
                        charge.Amount, evt.PaidAmount,
                        ConfidenceLevel.High, match.Reason, match.MatchedField),
                    charge);
            }

            // Outro fuzzy — trata como duplicata (a reserva original tem prioridade)
            return new ReconciliationOutcome(
                ReconciliationResult.Create(
                    orgId, charge.Id, evt.Id,
                    ReconciliationStatus.DuplicatePayment,
                    "Cobrança já reservada por outro match em análise.",
                    charge.Amount, evt.PaidAmount,
                    ConfidenceLevel.High, match.Reason, match.MatchedField),
                null);
        }

        // ── Cobrança Divergent com valor correto → re-concilia ────────────────────
        if (charge.Status == ChargeStatus.Divergent && evt.PaidAmount == charge.Amount
            && match.Confidence == ConfidenceLevel.High)
        {
            charge.MarkAsPaid();
            return new ReconciliationOutcome(
                ReconciliationResult.Create(
                    orgId, charge.Id, evt.Id,
                    ReconciliationStatus.Matched,
                    "Re-conciliado com sucesso após novo pagamento com valor correto.",
                    charge.Amount, evt.PaidAmount,
                    ConfidenceLevel.High, match.Reason, match.MatchedField),
                charge);
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

        // ── Valor divergente ──────────────────────────────────────────────────────
        if (evt.PaidAmount != charge.Amount)
        {
            charge.MarkAsDivergent();
            var delta = evt.PaidAmount - charge.Amount;
            return new ReconciliationOutcome(
                ReconciliationResult.Create(
                    orgId, charge.Id, evt.Id,
                    ReconciliationStatus.AmountMismatch,
                    $"Valor pago R${evt.PaidAmount:F2} difere do esperado R${charge.Amount:F2} (delta: {delta:+0.00;-0.00}).",
                    charge.Amount, evt.PaidAmount,
                    match.Confidence, MatchReason.FoundWithAmountMismatch, match.MatchedField),
                charge);
        }

        // ── Match de baixa/média confiança — reserva para revisão ─────────────────
        if (match.Confidence is ConfidenceLevel.Low or ConfidenceLevel.Medium)
        {
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

        // ── Happy path: match exato + valor correto ───────────────────────────────
        charge.MarkAsPaid();
        return new ReconciliationOutcome(
            ReconciliationResult.Create(
                orgId, charge.Id, evt.Id,
                ReconciliationStatus.Matched,
                "Pagamento conciliado com sucesso.",
                charge.Amount, evt.PaidAmount,
                ConfidenceLevel.High, match.Reason, match.MatchedField),
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
