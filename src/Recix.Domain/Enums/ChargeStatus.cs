namespace Recix.Domain.Enums;

public enum ChargeStatus
{
    /// <summary>Criada, aguardando pagamento.</summary>
    Pending,

    /// <summary>
    /// Pelo menos um pagamento foi vinculado, mas a soma recebida ainda é menor que o valor da cobrança.
    /// </summary>
    PartiallyPaid,

    /// <summary>
    /// Tentantivamente conciliada com baixa confiança.
    /// Aguarda confirmação humana — a cobrança fica "reservada" e não será usada
    /// em novos matching automáticos enquanto estiver neste estado.
    /// </summary>
    PendingReview,

    /// <summary>Paga e conciliada com sucesso.</summary>
    Paid,

    /// <summary>Prazo expirado sem recebimento de pagamento.</summary>
    Expired,

    /// <summary>Pagamento recebido mas com divergência (valor diferente, duplicado, etc.).</summary>
    Divergent,

    /// <summary>A soma dos pagamentos vinculados excede o valor esperado da cobrança.</summary>
    Overpaid,

    /// <summary>Cancelada manualmente.</summary>
    Cancelled,
}
