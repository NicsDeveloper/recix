using Recix.Domain.Enums;
using Recix.Domain.Exceptions;

namespace Recix.Domain.Entities;

public sealed class ReconciliationResult
{
    public Guid                 Id              { get; private set; }
    public Guid                 OrganizationId  { get; private set; }
    public Guid?                ChargeId        { get; private set; }
    public Guid                 PaymentEventId  { get; private set; }
    public ReconciliationStatus Status          { get; private set; }
    public string               Reason          { get; private set; } = default!;
    public decimal?             ExpectedAmount  { get; private set; }
    public decimal              PaidAmount      { get; private set; }
    public DateTime             CreatedAt       { get; private set; }

    // ── Campos de confiança e rastreabilidade do matching ─────────────────────────

    /// <summary>Nível de confiança do match. Low/Medium geram RequiresReview = true.</summary>
    public ConfidenceLevel  Confidence    { get; private set; }

    /// <summary>Campo ou estratégia que produziu o resultado.</summary>
    public MatchReason      MatchReason   { get; private set; }

    /// <summary>Nome legível do campo que gerou o match, ex: "ExternalChargeId".</summary>
    public string?          MatchedField  { get; private set; }

    /// <summary>Verdadeiro enquanto aguarda decisão humana — exclui do cômputo de KPIs.</summary>
    public bool             RequiresReview { get; private set; }

    // ── Auditoria de revisão humana ───────────────────────────────────────────────

    public DateTime?    ReviewedAt       { get; private set; }
    public Guid?        ReviewedByUserId { get; private set; }

    /// <summary>"Confirmed" ou "Rejected".</summary>
    public string?      ReviewDecision   { get; private set; }

    private ReconciliationResult() { }

    public static ReconciliationResult Create(
        Guid organizationId,
        Guid? chargeId,
        Guid paymentEventId,
        ReconciliationStatus status,
        string reason,
        decimal? expectedAmount,
        decimal paidAmount,
        ConfidenceLevel confidence = ConfidenceLevel.High,
        MatchReason matchReason    = MatchReason.ExactExternalChargeId,
        string? matchedField       = null)
    {
        bool requiresReview = status is ReconciliationStatus.MatchedLowConfidence
                                     or ReconciliationStatus.MultipleMatchCandidates;

        return new ReconciliationResult
        {
            Id             = Guid.NewGuid(),
            OrganizationId = organizationId,
            ChargeId       = chargeId,
            PaymentEventId = paymentEventId,
            Status         = status,
            Reason         = reason,
            ExpectedAmount = expectedAmount,
            PaidAmount     = paidAmount,
            CreatedAt      = DateTime.UtcNow,
            Confidence     = confidence,
            MatchReason    = matchReason,
            MatchedField   = matchedField,
            RequiresReview = requiresReview,
        };
    }

    /// <summary>
    /// Resultado especial gerado pelo sweep de expiração para cobranças que venceram
    /// sem nenhum pagamento — PaymentEventId é Guid.Empty (sentinel).
    /// </summary>
    public static ReconciliationResult CreateChargeWithoutPayment(
        Guid organizationId,
        Guid chargeId,
        decimal expectedAmount)
    {
        return new ReconciliationResult
        {
            Id             = Guid.NewGuid(),
            OrganizationId = organizationId,
            ChargeId       = chargeId,
            PaymentEventId = Guid.Empty,
            Status         = ReconciliationStatus.ChargeWithoutPayment,
            Reason         = "Cobrança expirou sem receber pagamento.",
            ExpectedAmount = expectedAmount,
            PaidAmount     = 0m,
            CreatedAt      = DateTime.UtcNow,
            Confidence     = ConfidenceLevel.High,
            MatchReason    = MatchReason.NoMatch,
            RequiresReview = false,
        };
    }

    /// <summary>Usuário confirmou o match de baixa confiança — torna-se definitivo.</summary>
    public void Confirm(Guid reviewerUserId)
    {
        if (!RequiresReview)
            throw new DomainException("Este resultado não está pendente de revisão.");

        Status           = ReconciliationStatus.Matched;
        Confidence       = ConfidenceLevel.High;
        RequiresReview   = false;
        ReviewedAt       = DateTime.UtcNow;
        ReviewedByUserId = reviewerUserId;
        ReviewDecision   = "Confirmed";
    }

    /// <summary>Usuário rejeitou o match — o resultado será removido e o pagamento reprocessado.</summary>
    public void Reject(Guid reviewerUserId)
    {
        if (!RequiresReview)
            throw new DomainException("Este resultado não está pendente de revisão.");

        ReviewedAt       = DateTime.UtcNow;
        ReviewedByUserId = reviewerUserId;
        ReviewDecision   = "Rejected";
    }

    /// <summary>
    /// Match fuzzy em revisão é descartado porque chegou pagamento com identificador exato da mesma cobrança.
    /// Não entra na soma de valores alocados até confirmação humana.
    /// </summary>
    public void MarkSupersededByExactIdMatch()
    {
        if (!RequiresReview)
            return;

        RequiresReview   = false;
        ReviewedAt       = DateTime.UtcNow;
        ReviewedByUserId = null;
        ReviewDecision   = "SupersededByExactId";
    }
}
