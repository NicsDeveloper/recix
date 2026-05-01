namespace Recix.Application.DTOs;

public sealed class ImportSalesResult
{
    public int Created  { get; init; }
    public int Skipped  { get; init; }
    public int Errors   { get; init; }
    public IReadOnlyList<ImportSalesLineResult> Lines { get; init; } = [];
}

public sealed class ImportSalesLineResult
{
    public int     Line        { get; init; }
    public string  Description { get; init; } = "";
    public decimal Amount      { get; init; }
    /// <summary>Created | Skipped | Error</summary>
    public string  Status      { get; init; } = "";
    public string? ReferenceId { get; init; }
    public string? Error       { get; init; }
}
