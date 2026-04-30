namespace Recix.Application.DTOs;

public sealed class ImportStatementResult
{
    public int Imported   { get; init; }
    public int Duplicates { get; init; }
    public int Errors     { get; init; }
    public IReadOnlyList<ImportStatementLineResult> Lines { get; init; } = [];
}

public sealed class ImportStatementLineResult
{
    public int     Line    { get; init; }
    public string  EventId { get; init; } = "";
    /// <summary>Imported | Duplicate | Error</summary>
    public string  Status  { get; init; } = "";
    public string? Error   { get; init; }
}
