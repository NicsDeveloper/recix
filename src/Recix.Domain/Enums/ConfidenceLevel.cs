namespace Recix.Domain.Enums;

public enum ConfidenceLevel
{
    /// <summary>Match por ExternalChargeId ou ReferenceId exato.</summary>
    High,

    /// <summary>Match por valor dentro de janela temporal (±48h).</summary>
    Medium,

    /// <summary>Match só por valor via FIFO, sem qualquer identificador. Requer revisão humana.</summary>
    Low,
}
