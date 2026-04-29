namespace Recix.Application.Interfaces;

public interface IAiInsightService
{
    Task<AiExplanationResult> ExplainReconciliationAsync(Guid reconciliationId, CancellationToken cancellationToken = default);
    Task<AiSummaryResult> GenerateDailySummaryAsync(DateTime date, CancellationToken cancellationToken = default);
}

public sealed class AiExplanationResult
{
    public Guid ReconciliationId { get; init; }
    public string Explanation { get; init; } = default!;
    public DateTime GeneratedAt { get; init; }
    public string Model { get; init; } = default!;
}

public sealed class AiSummaryResult
{
    public string Date { get; init; } = default!;
    public string Summary { get; init; } = default!;
    public DateTime GeneratedAt { get; init; }
    public string Model { get; init; } = default!;
}
