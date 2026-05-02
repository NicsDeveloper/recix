namespace Recix.Domain.Enums;

public enum ChargeStatus
{
    /// <summary>Criada, aguardando pagamento.</summary>
    Pending,

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

    /// <summary>Cancelada manualmente.</summary>
    Cancelled,
}
