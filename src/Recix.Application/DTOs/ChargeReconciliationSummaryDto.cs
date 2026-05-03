namespace Recix.Application.DTOs;

/// <summary>Visão agregada por cobrança para auditoria (uma linha = uma cobrança).</summary>
public sealed class ChargeReconciliationSummaryDto
{
    public Guid     ChargeId           { get; init; }
    public string   ChargeReferenceId  { get; init; } = "";
    public decimal  ExpectedAmount     { get; init; }
    public decimal  TotalPaidAllocated { get; init; }
    /// <summary>Total alocado menos esperado (positivo = excedente).</summary>
    public decimal  NetDifference      { get; init; }
    /// <summary>Conciliado | Parcial | Divergente | EmRevisao | SemAlocacao</summary>
    public string   AggregateStatus    { get; init; } = "";
    public DateTime LastEventAt        { get; init; }
    public IReadOnlyList<RecentReconciliationDto> PaymentLines { get; init; } = [];
}
