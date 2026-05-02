namespace Recix.Domain.Enums;

public enum ReconciliationStatus
{
    // ── Sucesso ───────────────────────────────────────────────────────────────────

    /// <summary>Conciliado com alta confiança (match por ID exato). Conta nos KPIs.</summary>
    Matched,

    /// <summary>
    /// Conciliado com baixa/média confiança (match por valor sem identificador).
    /// NÃO conta nos KPIs — requer confirmação humana antes de ser definitivo.
    /// </summary>
    MatchedLowConfidence,

    // ── Divergências ──────────────────────────────────────────────────────────────

    /// <summary>Cobrança encontrada mas o valor pago diverge do esperado.</summary>
    AmountMismatch,

    /// <summary>
    /// Pagamento vinculado à cobrança; a soma dos pagamentos contabilizados ainda não atinge o valor esperado.
    /// </summary>
    PartialPayment,

    /// <summary>
    /// Pagamento vinculado que faz a soma dos recebidos superar o valor esperado (excedente / possível duplicidade).
    /// </summary>
    PaymentExceedsExpected,

    /// <summary>Cobrança já conciliada recebeu um segundo pagamento.</summary>
    DuplicatePayment,

    /// <summary>Cobrança encontrada mas já havia expirado quando o pagamento chegou.</summary>
    ExpiredChargePaid,

    // ── Ausência ──────────────────────────────────────────────────────────────────

    /// <summary>Pagamento recebido sem nenhuma cobrança correspondente encontrada.</summary>
    PaymentWithoutCharge,

    /// <summary>
    /// Cobrança que venceu sem nenhum pagamento recebido.
    /// Gerado automaticamente pelo ExpirationSweepService.
    /// </summary>
    ChargeWithoutPayment,

    /// <summary>
    /// Fuzzy encontrou múltiplos candidatos — sistema não concilia automaticamente.
    /// Requer que o usuário selecione o candidato correto.
    /// </summary>
    MultipleMatchCandidates,

    // ── Erros ─────────────────────────────────────────────────────────────────────

    /// <summary>ExternalChargeId ou ReferenceId informado mas não encontrado no sistema.</summary>
    InvalidReference,

    /// <summary>Erro inesperado durante o processamento.</summary>
    ProcessingError,
}
