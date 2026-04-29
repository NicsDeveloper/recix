using System;
using System.Collections.Generic;
using System.Linq;
using Recix.Application.DTOs;
using Recix.Application.Interfaces;
using Recix.Domain.Enums;

namespace Recix.Application.Services;

public sealed class DashboardQueryService
{
    private readonly IChargeRepository _charges;
    private readonly IReconciliationRepository _reconciliations;
    private readonly IPaymentEventRepository _paymentEvents;

    public DashboardQueryService(
        IChargeRepository charges,
        IReconciliationRepository reconciliations,
        IPaymentEventRepository paymentEvents)
    {
        _charges = charges;
        _reconciliations = reconciliations;
        _paymentEvents = paymentEvents;
    }

    public async Task<DashboardSummaryDto> GetSummaryAsync(CancellationToken cancellationToken = default)
    {
        var chargesPage = await _charges.ListAsync(null, null, null, 1, int.MaxValue, cancellationToken);
        var reconciliationsPage = await _reconciliations.ListAsync(null, null, null, 1, int.MaxValue, cancellationToken);

        var charges = chargesPage.Items;
        var reconciliations = reconciliationsPage.Items;

        return new DashboardSummaryDto
        {
            TotalCharges = charges.Count,
            PaidCharges = charges.Count(c => c.Status == ChargeStatus.Paid),
            PendingCharges = charges.Count(c => c.Status == ChargeStatus.Pending),
            DivergentCharges = charges.Count(c => c.Status == ChargeStatus.Divergent),
            ExpiredCharges = charges.Count(c => c.Status == ChargeStatus.Expired),
            TotalReceivedAmount = charges
                .Where(c => c.Status == ChargeStatus.Paid)
                .Sum(c => c.Amount),
            TotalDivergentAmount = charges
                .Where(c => c.Status == ChargeStatus.Divergent)
                .Sum(c => c.Amount),
            ReconciliationIssues = new ReconciliationIssuesDto
            {
                AmountMismatch = reconciliations.Count(r => r.Status == ReconciliationStatus.AmountMismatch),
                DuplicatePayment = reconciliations.Count(r => r.Status == ReconciliationStatus.DuplicatePayment),
                PaymentWithoutCharge = reconciliations.Count(r => r.Status == ReconciliationStatus.PaymentWithoutCharge),
                ExpiredChargePaid = reconciliations.Count(r => r.Status == ReconciliationStatus.ExpiredChargePaid),
                InvalidReference = reconciliations.Count(r => r.Status == ReconciliationStatus.InvalidReference),
                ProcessingError = reconciliations.Count(r => r.Status == ReconciliationStatus.ProcessingError)
            }
        };
    }

    public async Task<DashboardOverviewDto> GetOverviewAsync(
        DateTime? fromDate,
        DateTime? toDate,
        CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;

        var resolvedFrom = (fromDate ?? now).Date;
        var resolvedTo = (toDate ?? resolvedFrom).Date;
        if (resolvedTo < resolvedFrom)
        {
            (resolvedFrom, resolvedTo) = (resolvedTo, resolvedFrom);
        }

        var rangeStart = resolvedFrom;
        var rangeEndExclusive = resolvedTo.AddDays(1); // fim exclusivo para filtros por DateTime

        var rangeLengthDays = (resolvedTo - resolvedFrom).Days + 1;
        var previousFrom = resolvedFrom.AddDays(-rangeLengthDays);
        var previousTo = resolvedFrom.AddDays(-1);

        // ─── Summary + previous period ─────────────────────────────────────────────
        var summary = await ComputeSummaryAsync(rangeStart, resolvedTo, cancellationToken);
        var previousSummary = await ComputeSummaryAsync(previousFrom, previousTo, cancellationToken);

        // ─── Flux series ──────────────────────────────────────────────────────────
        var chargesInPeriod = await _charges.ListAsync(null, rangeStart, resolvedTo, 1, int.MaxValue, cancellationToken);
        var reconciliationsInPeriod = await _reconciliations.ListAsync(null, null, null, 1, int.MaxValue, cancellationToken);
        var reconFiltered = reconciliationsInPeriod.Items
            .Where(r => r.CreatedAt >= rangeStart && r.CreatedAt < rangeEndExclusive)
            .ToList();

        var fluxSeries = BuildFluxSeries(
            chargesInPeriod.Items,
            rangeStart,
            rangeEndExclusive);

        // ─── Recent tables ────────────────────────────────────────────────────────
        var recentReconciliations = await MapRecentReconciliationsAsync(
            reconFiltered,
            cancellationToken);

        var recentPaymentEvents = await MapRecentPaymentEventsAsync(
            rangeStart,
            rangeEndExclusive,
            cancellationToken);

        // ─── Alerts ───────────────────────────────────────────────────────────────
        var alerts = BuildAlerts(reconFiltered);

        // ─── UpdatedAt ───────────────────────────────────────────────────────────
        var latestChargeUpdatedAt = chargesInPeriod.Items
            .Select(c => c.UpdatedAt ?? c.CreatedAt)
            .DefaultIfEmpty(now)
            .Max();

        var latestReconCreatedAt = reconFiltered
            .Select(r => r.CreatedAt)
            .DefaultIfEmpty(now)
            .Max();

        var latestPaymentUpdatedAt = recentPaymentEvents
            .Select(e => e.ProcessedAt ?? e.PaidAt)
            .DefaultIfEmpty(now)
            .Max();

        var updatedAt = new[] { latestChargeUpdatedAt, latestReconCreatedAt, latestPaymentUpdatedAt }.Max();

        return new DashboardOverviewDto
        {
            UpdatedAt = updatedAt,
            Summary = summary,
            PreviousPeriodSummary = previousSummary,
            FluxSeries = fluxSeries,
            RecentReconciliations = recentReconciliations,
            RecentPaymentEvents = recentPaymentEvents,
            Alerts = alerts
        };
    }

    private async Task<DashboardSummaryDto> ComputeSummaryAsync(
        DateTime start,
        DateTime endInclusive,
        CancellationToken cancellationToken)
    {
        // Repositories já usam CreatedAt como base para filtros de intervalo.
        var chargesPage = await _charges.ListAsync(null, start, endInclusive, 1, int.MaxValue, cancellationToken);
        var charges = chargesPage.Items;

        var reconciliationsPage = await _reconciliations.ListAsync(null, null, null, 1, int.MaxValue, cancellationToken);
        var reconciliations = reconciliationsPage.Items
            .Where(r => r.CreatedAt >= start && r.CreatedAt < endInclusive.AddDays(1))
            .ToList();

        return new DashboardSummaryDto
        {
            TotalCharges = charges.Count,
            PaidCharges = charges.Count(c => c.Status == ChargeStatus.Paid),
            PendingCharges = charges.Count(c => c.Status == ChargeStatus.Pending),
            DivergentCharges = charges.Count(c => c.Status == ChargeStatus.Divergent),
            ExpiredCharges = charges.Count(c => c.Status == ChargeStatus.Expired),
            TotalReceivedAmount = charges
                .Where(c => c.Status == ChargeStatus.Paid)
                .Sum(c => c.Amount),
            TotalDivergentAmount = charges
                .Where(c => c.Status == ChargeStatus.Divergent)
                .Sum(c => c.Amount),
            ReconciliationIssues = new ReconciliationIssuesDto
            {
                AmountMismatch = reconciliations.Count(r => r.Status == ReconciliationStatus.AmountMismatch),
                DuplicatePayment = reconciliations.Count(r => r.Status == ReconciliationStatus.DuplicatePayment),
                PaymentWithoutCharge = reconciliations.Count(r => r.Status == ReconciliationStatus.PaymentWithoutCharge),
                ExpiredChargePaid = reconciliations.Count(r => r.Status == ReconciliationStatus.ExpiredChargePaid),
                InvalidReference = reconciliations.Count(r => r.Status == ReconciliationStatus.InvalidReference),
                ProcessingError = reconciliations.Count(r => r.Status == ReconciliationStatus.ProcessingError)
            }
        };
    }

    private static IReadOnlyList<FluxSeriesPointDto> BuildFluxSeries(
        IReadOnlyList<Recix.Domain.Entities.Charge> charges,
        DateTime rangeStart,
        DateTime rangeEndExclusive)
    {
        const int bucketCount = 8;

        var duration = rangeEndExclusive - rangeStart;
        var rangeInHours = duration.TotalHours;
        var isHourly = rangeInHours <= 24;

        var stepTicks = duration.Ticks / (bucketCount - 1);
        if (stepTicks <= 0)
            stepTicks = duration.Ticks;

        var points = new List<FluxSeriesPointDto>(bucketCount);

        var paid = charges
            .Where(c => c.Status == ChargeStatus.Paid)
            .Select(c => new { UpdatedAt = c.UpdatedAt ?? c.CreatedAt, c.Amount })
            .Where(x => x.UpdatedAt >= rangeStart && x.UpdatedAt < rangeEndExclusive)
            .ToList();

        var divergent = charges
            .Where(c => c.Status == ChargeStatus.Divergent)
            .Select(c => new { UpdatedAt = c.UpdatedAt ?? c.CreatedAt, c.Amount })
            .Where(x => x.UpdatedAt >= rangeStart && x.UpdatedAt < rangeEndExclusive)
            .ToList();

        for (var i = 0; i < bucketCount; i++)
        {
            var t = rangeStart.AddTicks(i * stepTicks);

            var received = paid
                .Where(x => x.UpdatedAt <= t)
                .Sum(x => x.Amount);

            var div = divergent
                .Where(x => x.UpdatedAt <= t)
                .Sum(x => x.Amount);

            var expected = received - div;

            var label = isHourly ? t.ToString("HH:mm") : t.ToString("dd/MM");

            points.Add(new FluxSeriesPointDto
            {
                Label = label,
                Received = received,
                Expected = expected,
                Divergent = div
            });
        }

        return points;
    }

    private async Task<IReadOnlyList<RecentReconciliationDto>> MapRecentReconciliationsAsync(
        IReadOnlyList<Recix.Domain.Entities.ReconciliationResult> reconFiltered,
        CancellationToken cancellationToken)
    {
        var latest = reconFiltered
            .OrderByDescending(r => r.CreatedAt)
            .Take(5)
            .ToList();

        if (latest.Count == 0)
            return Array.Empty<RecentReconciliationDto>();

        // Mapeia dependências (Charge + PaymentEvent) apenas para os itens recentes.
        var chargeCache = new Dictionary<Guid, Recix.Domain.Entities.Charge>();
        var paymentCache = new Dictionary<Guid, Recix.Domain.Entities.PaymentEvent>();

        var result = new List<RecentReconciliationDto>(latest.Count);
        foreach (var r in latest)
        {
            string? chargeReferenceId = null;
            if (r.ChargeId.HasValue)
            {
                if (!chargeCache.TryGetValue(r.ChargeId.Value, out var ch))
                {
                    ch = await _charges.GetByIdAsync(r.ChargeId.Value, cancellationToken);
                    if (ch is not null)
                        chargeCache[r.ChargeId.Value] = ch;
                }

                if (ch is not null)
                    chargeReferenceId = ch.ReferenceId;
            }

            Recix.Domain.Entities.PaymentEvent? paymentEvent = null;
            if (!paymentCache.TryGetValue(r.PaymentEventId, out paymentEvent))
            {
                paymentEvent = await _paymentEvents.GetByIdAsync(r.PaymentEventId, cancellationToken);
                if (paymentEvent is not null)
                    paymentCache[r.PaymentEventId] = paymentEvent;
            }

            result.Add(new RecentReconciliationDto
            {
                Id = r.Id,
                Status = r.Status.ToString(),
                Reason = r.Reason,
                ExpectedAmount = r.ExpectedAmount,
                PaidAmount = r.PaidAmount,
                ChargeReferenceId = chargeReferenceId,
                PaymentEventId = paymentEvent?.EventId ?? r.PaymentEventId.ToString(),
                CreatedAt = r.CreatedAt
            });
        }

        return result;
    }

    private async Task<IReadOnlyList<RecentPaymentEventDto>> MapRecentPaymentEventsAsync(
        DateTime rangeStart,
        DateTime rangeEndExclusive,
        CancellationToken cancellationToken)
    {
        var processedPage = await _paymentEvents.ListAsync(
            PaymentEventStatus.Processed,
            1,
            int.MaxValue,
            cancellationToken);

        // Prioriza “últimos” com base em paidAt, já que o texto do card pede “Recebido em”.
        var filtered = processedPage.Items
            .Where(e => e.PaidAt >= rangeStart && e.PaidAt < rangeEndExclusive)
            .OrderByDescending(e => e.PaidAt)
            .Take(5)
            .ToList();

        if (filtered.Count == 0)
            return Array.Empty<RecentPaymentEventDto>();

        return filtered.Select(e => new RecentPaymentEventDto
        {
            EventId = e.EventId,
            ReferenceId = e.ReferenceId,
            PaidAmount = e.PaidAmount,
            Provider = e.Provider,
            Status = e.Status.ToString(),
            PaidAt = e.PaidAt,
            ProcessedAt = e.ProcessedAt,
            CreatedAt = e.CreatedAt
        }).ToList();
    }

    private static IReadOnlyList<DashboardAlertDto> BuildAlerts(IReadOnlyList<Recix.Domain.Entities.ReconciliationResult> reconFiltered)
    {
        var now = DateTime.UtcNow;

        var amountMismatch = reconFiltered.Where(r => r.Status == ReconciliationStatus.AmountMismatch).ToList();
        var duplicatePayment = reconFiltered.Where(r => r.Status == ReconciliationStatus.DuplicatePayment).ToList();
        var paymentWithoutCharge = reconFiltered.Where(r => r.Status == ReconciliationStatus.PaymentWithoutCharge).ToList();

        DateTime lastOrDefault(List<Recix.Domain.Entities.ReconciliationResult> items) =>
            items.Count == 0 ? now : items.Max(x => x.CreatedAt);

        return new List<DashboardAlertDto>
        {
            new DashboardAlertDto
            {
                Type = "amountMismatch",
                Count = amountMismatch.Count,
                LastDetectedAt = lastOrDefault(amountMismatch),
                Description = "Divergência de valor detectada no período.",
                RouteStatus = ReconciliationStatus.AmountMismatch.ToString()
            },
            new DashboardAlertDto
            {
                Type = "duplicatePayment",
                Count = duplicatePayment.Count,
                LastDetectedAt = lastOrDefault(duplicatePayment),
                Description = "Pagamentos duplicados detectados no período.",
                RouteStatus = ReconciliationStatus.DuplicatePayment.ToString()
            },
            new DashboardAlertDto
            {
                Type = "paymentWithoutCharge",
                Count = paymentWithoutCharge.Count,
                LastDetectedAt = lastOrDefault(paymentWithoutCharge),
                Description = "Pagamentos sem cobrança correspondente detectados.",
                RouteStatus = ReconciliationStatus.PaymentWithoutCharge.ToString()
            }
        };
    }
}
