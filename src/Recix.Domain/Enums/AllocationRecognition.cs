namespace Recix.Domain.Enums;

/// <summary>Como o valor alocado entra no saldo reconhecido da cobrança.</summary>
public enum AllocationRecognition
{
    /// <summary>Conta no saldo reconhecido (motor, confirmação humana, etc.).</summary>
    Recognized = 0,

    /// <summary>Reservado para extensões futuras (ex.: provisório antes de auditoria).</summary>
    Provisional = 1,
}
