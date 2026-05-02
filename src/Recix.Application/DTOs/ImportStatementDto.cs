namespace Recix.Application.DTOs;

public sealed class ImportStatementResult
{
    public int Imported   { get; init; }
    public int Duplicates { get; init; }
    public int Errors     { get; init; }

    /// <summary>Subset de Imported: conciliados com alta confiança (match por ID).</summary>
    public int MatchedHigh { get; init; }

    /// <summary>Subset de Imported: conciliados com baixa confiança — requerem revisão humana.</summary>
    public int MatchedLowConfidence { get; init; }

    /// <summary>Subset de Imported: divergências detectadas (valor errado, expirado, sem cobrança, etc.).</summary>
    public int Divergent { get; init; }

    public IReadOnlyList<ImportStatementLineResult> Lines { get; init; } = [];
}

public sealed class ImportStatementLineResult
{
    public int     Line    { get; init; }
    public string  EventId { get; init; } = "";

    /// <summary>Imported | Duplicate | Error</summary>
    public string  Status  { get; init; } = "";

    /// <summary>Status da conciliação gerada, ex: Matched, MatchedLowConfidence, PaymentWithoutCharge.</summary>
    public string? ReconciliationStatus { get; init; }

    public string? Error   { get; init; }
}
