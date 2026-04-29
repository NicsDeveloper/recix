using System;
using System.Collections.Generic;
using Recix.Domain.Enums;

namespace Recix.Application.DTOs;

public sealed class DashboardOverviewDto
{
    public DateTime UpdatedAt { get; init; }

    public DashboardSummaryDto Summary { get; init; } = new();

    public DashboardSummaryDto PreviousPeriodSummary { get; init; } = new();

    public IReadOnlyList<FluxSeriesPointDto> FluxSeries { get; init; } = Array.Empty<FluxSeriesPointDto>();

    public IReadOnlyList<RecentReconciliationDto> RecentReconciliations { get; init; } = Array.Empty<RecentReconciliationDto>();

    public IReadOnlyList<RecentPaymentEventDto> RecentPaymentEvents { get; init; } = Array.Empty<RecentPaymentEventDto>();

    public IReadOnlyList<DashboardAlertDto> Alerts { get; init; } = Array.Empty<DashboardAlertDto>();
}

public sealed class FluxSeriesPointDto
{
    public string Label { get; init; } = default!;
    public decimal Received { get; init; }
    public decimal Expected { get; init; }
    public decimal Divergent { get; init; }
}

public sealed class RecentReconciliationDto
{
    public Guid Id { get; init; }
    public string Status { get; init; } = default!;
    public string Reason { get; init; } = default!;
    public decimal? ExpectedAmount { get; init; }
    public decimal PaidAmount { get; init; }
    public string? ChargeReferenceId { get; init; }
    public string PaymentEventId { get; init; } = default!;
    public DateTime CreatedAt { get; init; }
}

public sealed class RecentPaymentEventDto
{
    public string EventId { get; init; } = default!;
    public string? ReferenceId { get; init; }
    public decimal PaidAmount { get; init; }
    public string Provider { get; init; } = default!;
    public string Status { get; init; } = default!;
    public DateTime PaidAt { get; init; }
    public DateTime? ProcessedAt { get; init; }
    public DateTime CreatedAt { get; init; }
}

public sealed class DashboardAlertDto
{
    /// <summary>Chave textual usada na UI para rotas/ícones.</summary>
    public string Type { get; init; } = default!;

    public int Count { get; init; }

    public DateTime LastDetectedAt { get; init; }

    public string Description { get; init; } = default!;

    /// <summary>Valor textual para preencher `?status=` na rota de conciliações.</summary>
    public string RouteStatus { get; init; } = default!;
}

