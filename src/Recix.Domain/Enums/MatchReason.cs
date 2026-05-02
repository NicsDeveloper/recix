namespace Recix.Domain.Enums;

public enum MatchReason
{
    /// <summary>Match por ExternalChargeId exato.</summary>
    ExactExternalChargeId,

    /// <summary>Match por ReferenceId exato.</summary>
    ExactReferenceId,

    /// <summary>Match por valor dentro da janela temporal de ±48h, candidato único.</summary>
    ValueWithinTimeWindow,

    /// <summary>Match por valor FIFO sem janela temporal, candidato único.</summary>
    ValueFifo,

    /// <summary>Nenhuma cobrança correspondente encontrada.</summary>
    NoMatch,

    /// <summary>Cobrança já conciliada — pagamento duplicado.</summary>
    AlreadySettled,

    /// <summary>ReferenceId/ExternalChargeId informado mas não encontrado no sistema.</summary>
    InvalidReference,

    /// <summary>Múltiplos candidatos encontrados — requer seleção humana.</summary>
    MultipleCandidates,

    /// <summary>Cobrança encontrada mas o valor difere do pagamento.</summary>
    FoundWithAmountMismatch,

    /// <summary>Cobrança encontrada mas já havia expirado.</summary>
    FoundButExpired,

    /// <summary>Soma de pagamentos vinculados completou o valor esperado.</summary>
    CumulativeSettlement,

    /// <summary>O pagamento excede o saldo pendente da cobrança.</summary>
    PaymentExceedsBalance,
}
