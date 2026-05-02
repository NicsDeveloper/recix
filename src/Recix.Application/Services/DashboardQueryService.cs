using Recix.Application.DTOs;
using Recix.Application.Interfaces;
using Recix.Domain.Enums;

namespace Recix.Application.Services;

public sealed class DashboardQueryService(
    IChargeRepository charges,
    IReconciliationRepository reconciliations,
    IPaymentEventRepository paymentEvents)
{
    // ─── Public ──────────────────────────────────────────────────────────────────

    public async Task<DashboardSummaryDto> GetSummaryAsync(CancellationToken ct = default)
    {
        var chPage    = await charges.ListAsync(null, null, null, 1, int.MaxValue, ct);
        var reconPage = await reconciliations.ListAsync(null, null, null, 1, int.MaxValue, ct);
        return BuildSummary(chPage.Items, reconPage.Items);
    }

    public async Task<DashboardOverviewDto> GetOverviewAsync(
        DateTime? fromDate,
        DateTime? toDate,
        CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;

        var resolvedFrom = (fromDate ?? now).ToUniversalTime().Date;
        var resolvedTo   = (toDate   ?? resolvedFrom).ToUniversalTime().Date;
        if (resolvedTo < resolvedFrom) (resolvedFrom, resolvedTo) = (resolvedTo, resolvedFrom);

        var rangeEnd = resolvedTo.AddDays(1); // exclusivo
        var days     = (resolvedTo - resolvedFrom).Days + 1;
        var prevFrom = resolvedFrom.AddDays(-days);
        var prevTo   = resolvedFrom.AddDays(-1);

        // ─── Cobranças do período ─────────────────────────────────────────────────
        var chPage    = await charges.ListAsync(null, resolvedFrom, resolvedTo, 1, int.MaxValue, ct);
        var chList    = chPage.Items;

        // ─── Conciliações do período ──────────────────────────────────────────────
        var reconPage = await reconciliations.ListAsync(null, null, null, 1, int.MaxValue, ct);
        var reconList = reconPage.Items
            .Where(r => r.CreatedAt >= resolvedFrom && r.CreatedAt < rangeEnd)
            .ToList();

        // ─── Período anterior ─────────────────────────────────────────────────────
        var prevChPage    = await charges.ListAsync(null, prevFrom, prevTo, 1, int.MaxValue, ct);
        var prevReconPage = await reconciliations.ListAsync(null, null, null, 1, int.MaxValue, ct);
        var prevReconList = prevReconPage.Items
            .Where(r => r.CreatedAt >= prevFrom && r.CreatedAt < resolvedFrom)
            .ToList();

        var summary     = BuildSummary(chList, reconList);
        var prevSummary = BuildSummary(prevChPage.Items, prevReconList);
        var fluxSeries  = BuildFluxSeries(chList, resolvedFrom, rangeEnd);

        // ─── Últimas conciliações e pagamentos ────────────────────────────────────
        var recentRecon   = await MapRecentReconciliationsAsync(reconList, ct);
        var recentPayment = await MapRecentPaymentEventsAsync(resolvedFrom, rangeEnd, ct);
        var alerts        = BuildAlerts(reconList);

        var updatedAt = chList
            .Select(c => c.UpdatedAt ?? c.CreatedAt)
            .Concat(reconList.Select(r => r.CreatedAt))
            .DefaultIfEmpty(now)
            .Max();

        return new DashboardOverviewDto
        {
            UpdatedAt             = updatedAt,
            Summary               = summary,
            PreviousPeriodSummary = prevSummary,
            FluxSeries            = fluxSeries,
            RecentReconciliations = recentRecon,
            RecentPaymentEvents   = recentPayment,
            Alerts                = alerts,
        };
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────────

    private static DashboardSummaryDto BuildSummary(
        IReadOnlyList<Domain.Entities.Charge> ch,
        IReadOnlyList<Domain.Entities.ReconciliationResult> rc)
    {
        var chargeDiv = ch.Where(c => c.Status == ChargeStatus.Divergent).Sum(c => c.Amount);
        var reconAtt  = SumReconciliationAttentionAmount(rc);

        return new DashboardSummaryDto
        {
            TotalCharges          = ch.Count,
            PaidCharges           = ch.Count(c => c.Status == ChargeStatus.Paid),
            PendingCharges        = ch.Count(c => c.Status == ChargeStatus.Pending),
            DivergentCharges      = ch.Count(c => c.Status == ChargeStatus.Divergent),
            ExpiredCharges        = ch.Count(c => c.Status == ChargeStatus.Expired),
            TotalReceivedAmount   = ch.Where(c => c.Status == ChargeStatus.Paid).Sum(c => c.Amount),
            TotalDivergentAmount  = chargeDiv,
            TotalReconciliationAttentionAmount = reconAtt,
            ReconciliationIssues  = new ReconciliationIssuesDto
            {
                Matched              = rc.Count(r => r.Status == ReconciliationStatus.Matched),
                AmountMismatch       = rc.Count(r => r.Status == ReconciliationStatus.AmountMismatch),
                DuplicatePayment     = rc.Count(r => r.Status == ReconciliationStatus.DuplicatePayment),
                PaymentWithoutCharge = rc.Count(r => r.Status == ReconciliationStatus.PaymentWithoutCharge),
                ExpiredChargePaid    = rc.Count(r => r.Status == ReconciliationStatus.ExpiredChargePaid),
                InvalidReference     = rc.Count(r => r.Status == ReconciliationStatus.InvalidReference),
                ProcessingError      = rc.Count(r => r.Status == ReconciliationStatus.ProcessingError),
            },
        };
    }

    /// <summary>
    /// Valores em risco / não alinhados segundo o resultado da conciliação (independente do status da cobrança).
    /// </summary>
    private static decimal SumReconciliationAttentionAmount(
        IReadOnlyList<Domain.Entities.ReconciliationResult> rc)
    {
        decimal sum = 0;
        foreach (var r in rc)
        {
            switch (r.Status)
            {
                case ReconciliationStatus.AmountMismatch:
                    sum += r.ExpectedAmount is { } exp
                        ? Math.Abs(r.PaidAmount - exp)
                        : r.PaidAmount;
                    break;
                case ReconciliationStatus.PaymentWithoutCharge:
                case ReconciliationStatus.DuplicatePayment:
                case ReconciliationStatus.ExpiredChargePaid:
                    sum += r.PaidAmount;
                    break;
                case ReconciliationStatus.InvalidReference:
                case ReconciliationStatus.ProcessingError:
                    sum += r.PaidAmount;
                    break;
                default:
                    break;
            }
        }

        return sum;
    }

    private static IReadOnlyList<FluxSeriesPointDto> BuildFluxSeries(
        IReadOnlyList<Domain.Entities.Charge> ch,
        DateTime rangeStart,
        DateTime rangeEnd)
    {
        const int buckets  = 8;
        var duration       = rangeEnd - rangeStart;
        var isHourly       = duration.TotalHours <= 24;
        var step           = TimeSpan.FromTicks(Math.Max(duration.Ticks / (buckets - 1), 1));

        var paid = ch.Where(c => c.Status == ChargeStatus.Paid)
                     .Select(c => (at: c.UpdatedAt ?? c.CreatedAt, c.Amount))
                     .Where(x => x.at >= rangeStart && x.at < rangeEnd).ToList();

        var div  = ch.Where(c => c.Status == ChargeStatus.Divergent)
                     .Select(c => (at: c.UpdatedAt ?? c.CreatedAt, c.Amount))
                     .Where(x => x.at >= rangeStart && x.at < rangeEnd).ToList();

        return Enumerable.Range(0, buckets).Select(i =>
        {
            var t        = rangeStart + step * i;
            var received = paid.Where(x => x.at <= t).Sum(x => x.Amount);
            var diverged = div.Where(x => x.at <= t).Sum(x => x.Amount);
            return new FluxSeriesPointDto
            {
                Label    = isHourly ? t.ToString("HH:mm") : t.ToString("dd/MM"),
                Received = received,
                Expected = received - diverged,
                Divergent = diverged,
            };
        }).ToList();
    }

    private static readonly ReconciliationStatus[] DivergentStatuses =
    [
        ReconciliationStatus.AmountMismatch,
        ReconciliationStatus.DuplicatePayment,
        ReconciliationStatus.PaymentWithoutCharge,
        ReconciliationStatus.ExpiredChargePaid,
        ReconciliationStatus.InvalidReference,
        ReconciliationStatus.ProcessingError,
    ];

    public async Task<PagedResult<RecentReconciliationDto>> GetReconciliationsListAsync(
        ReconciliationStatus? status,
        DateTime? fromDate,
        DateTime? toDate,
        int page,
        int pageSize,
        CancellationToken ct = default,
        bool divergentOnly = false)
    {
        var reconPage = await reconciliations.ListAsync(status, null, null, 1, int.MaxValue, ct);
        var filtered = reconPage.Items.AsEnumerable();

        if (divergentOnly && status is null)
            filtered = filtered.Where(r => DivergentStatuses.Contains(r.Status));

        if (fromDate.HasValue)
            filtered = filtered.Where(r => r.CreatedAt.Date >= fromDate.Value.ToUniversalTime().Date);
        if (toDate.HasValue)
            filtered = filtered.Where(r => r.CreatedAt.Date <= toDate.Value.ToUniversalTime().Date);

        var ordered = filtered.OrderByDescending(r => r.CreatedAt).ToList();
        var total   = ordered.Count;
        var slice   = ordered.Skip((page - 1) * pageSize).Take(pageSize).ToList();

        var enriched = await EnrichReconciliationsAsync(slice, ct);
        return new PagedResult<RecentReconciliationDto>
        {
            Items      = [.. enriched],
            TotalCount = total,
            Page       = page,
            PageSize   = pageSize,
        };
    }

    private async Task<IReadOnlyList<RecentReconciliationDto>> MapRecentReconciliationsAsync(
        IReadOnlyList<Domain.Entities.ReconciliationResult> rc,
        CancellationToken ct)
    {
        var latest = rc.OrderByDescending(r => r.CreatedAt).Take(10).ToList();
        return latest.Count == 0 ? [] : await EnrichReconciliationsAsync(latest, ct);
    }

    private async Task<IReadOnlyList<RecentReconciliationDto>> EnrichReconciliationsAsync(
        IReadOnlyList<Domain.Entities.ReconciliationResult> rc,
        CancellationToken ct)
    {
        var chargeCache  = new Dictionary<Guid, Domain.Entities.Charge>();
        var paymentCache = new Dictionary<Guid, Domain.Entities.PaymentEvent>();
        var result       = new List<RecentReconciliationDto>(rc.Count);

        foreach (var r in rc)
        {
            string? chargeRef = null;
            if (r.ChargeId.HasValue)
            {
                if (!chargeCache.TryGetValue(r.ChargeId.Value, out var c))
                {
                    c = await charges.GetByIdAsync(r.ChargeId.Value, ct);
                    if (c is not null) chargeCache[r.ChargeId.Value] = c;
                }
                chargeRef = c?.ReferenceId;
            }

            if (!paymentCache.TryGetValue(r.PaymentEventId, out var pe))
            {
                pe = await paymentEvents.GetByIdAsync(r.PaymentEventId, ct);
                if (pe is not null) paymentCache[r.PaymentEventId] = pe;
            }

            result.Add(new RecentReconciliationDto
            {
                Id                = r.Id,
                Status            = r.Status.ToString(),
                Reason            = r.Reason,
                ExpectedAmount    = r.ExpectedAmount,
                PaidAmount        = r.PaidAmount,
                ChargeReferenceId = chargeRef,
                PaymentEventId    = pe?.EventId ?? r.PaymentEventId.ToString(),
                Provider          = pe?.Provider,
                CreatedAt         = r.CreatedAt,
                Confidence        = r.Confidence.ToString(),
                MatchReason       = r.MatchReason.ToString(),
                MatchedField      = r.MatchedField,
                RequiresReview    = r.RequiresReview,
            });
        }
        return result;
    }

    private async Task<IReadOnlyList<RecentPaymentEventDto>> MapRecentPaymentEventsAsync(
        DateTime rangeStart, DateTime rangeEnd, CancellationToken ct)
    {
        var page = await paymentEvents.ListAsync(null, 1, int.MaxValue, ct);

        var filtered = page.Items
            .Where(e => e.PaidAt >= rangeStart && e.PaidAt < rangeEnd)
            .OrderByDescending(e => e.PaidAt)
            .Take(10)
            .ToList();

        // Se nenhum no período, retorna os 5 mais recentes globalmente
        if (filtered.Count == 0)
            filtered = page.Items.OrderByDescending(e => e.PaidAt).Take(5).ToList();

        return filtered.Select(e => new RecentPaymentEventDto
        {
            EventId     = e.EventId,
            ReferenceId = e.ReferenceId,
            PaidAmount  = e.PaidAmount,
            Provider    = e.Provider,
            Status      = e.Status.ToString(),
            PaidAt      = e.PaidAt,
            ProcessedAt = e.ProcessedAt,
            CreatedAt   = e.CreatedAt,
        }).ToList();
    }

    // ─── Closing Report ──────────────────────────────────────────────────────────

    public async Task<ClosingReportDto> GetClosingReportAsync(
        DateTime from,
        DateTime to,
        CancellationToken ct = default)
    {
        var fromUtc  = from.ToUniversalTime().Date;
        var toUtc    = to.ToUniversalTime().Date;
        if (toUtc < fromUtc) (fromUtc, toUtc) = (toUtc, fromUtc);
        var rangeEnd = toUtc.AddDays(1);

        var chPage    = await charges.ListAsync(null, fromUtc, toUtc, 1, int.MaxValue, ct);
        var ch        = chPage.Items;
        var reconPage = await reconciliations.ListAsync(null, null, null, 1, int.MaxValue, ct);
        var rc        = reconPage.Items
            .Where(r => r.CreatedAt >= fromUtc && r.CreatedAt < rangeEnd)
            .ToList();

        var paid     = ch.Where(c => c.Status == ChargeStatus.Paid).ToList();
        var divg     = ch.Where(c => c.Status == ChargeStatus.Divergent).ToList();
        var pending  = ch.Where(c => c.Status == ChargeStatus.Pending).ToList();

        var expected  = ch.Sum(c => c.Amount);
        var received  = paid.Sum(c => c.Amount);
        var divergent = divg.Sum(c => c.Amount);
        var pendAmt   = pending.Sum(c => c.Amount);
        var recovery  = expected > 0 ? Math.Round(received / expected * 100, 2) : 0m;

        // Cobranças sem nenhuma conciliação no período
        var reconciledChargeIds = rc.Where(r => r.ChargeId.HasValue)
                                    .Select(r => r.ChargeId!.Value)
                                    .ToHashSet();

        var unreconciled = ch
            .Where(c => c.Status is ChargeStatus.Pending or ChargeStatus.Expired
                        && !reconciledChargeIds.Contains(c.Id))
            .OrderByDescending(c => c.Amount)
            .Take(50)
            .Select(c => new UnreconciledChargeDto
            {
                Id          = c.Id,
                ReferenceId = c.ReferenceId ?? c.ExternalId,
                Amount      = c.Amount,
                Status      = c.Status.ToString(),
                ExpiresAt   = c.ExpiresAt,
                CreatedAt   = c.CreatedAt,
            })
            .ToList();

        return new ClosingReportDto
        {
            From             = fromUtc,
            To               = toUtc,
            TotalCharges     = ch.Count,
            PaidCharges      = paid.Count,
            PendingCharges   = pending.Count,
            DivergentCharges = divg.Count,
            ExpiredCharges   = ch.Count(c => c.Status == ChargeStatus.Expired),
            ExpectedAmount   = expected,
            ReceivedAmount   = received,
            DivergentAmount  = divergent,
            PendingAmount    = pendAmt,
            RecoveryRate     = recovery,
            ReconciliationsTotal          = rc.Count,
            ReconciliationsMatched        = rc.Count(r => r.Status == ReconciliationStatus.Matched),
            ReconciliationsAmountMismatch = rc.Count(r => r.Status == ReconciliationStatus.AmountMismatch),
            ReconciliationsDuplicate      = rc.Count(r => r.Status == ReconciliationStatus.DuplicatePayment),
            ReconciliationsNoCharge       = rc.Count(r => r.Status == ReconciliationStatus.PaymentWithoutCharge),
            ReconciliationsExpiredPaid    = rc.Count(r => r.Status == ReconciliationStatus.ExpiredChargePaid),
            ReconciliationsInvalidRef     = rc.Count(r => r.Status == ReconciliationStatus.InvalidReference),
            ReconciliationsError          = rc.Count(r => r.Status == ReconciliationStatus.ProcessingError),
            Unreconciled     = unreconciled,
        };
    }

    private static IReadOnlyList<DashboardAlertDto> BuildAlerts(
        IReadOnlyList<Domain.Entities.ReconciliationResult> rc)
    {
        var now = DateTime.UtcNow;
        DateTime Last(IEnumerable<Domain.Entities.ReconciliationResult> items) =>
            items.Select(x => x.CreatedAt).DefaultIfEmpty(now).Max();

        var mm  = rc.Where(r => r.Status == ReconciliationStatus.AmountMismatch).ToList();
        var dup = rc.Where(r => r.Status == ReconciliationStatus.DuplicatePayment).ToList();
        var pwc = rc.Where(r => r.Status == ReconciliationStatus.PaymentWithoutCharge).ToList();

        return new[]
        {
            new DashboardAlertDto { Type = "amountMismatch",       Count = mm.Count,  LastDetectedAt = Last(mm),  Description = "Divergência de valor detectada no período.",                  RouteStatus = "AmountMismatch" },
            new DashboardAlertDto { Type = "duplicatePayment",     Count = dup.Count, LastDetectedAt = Last(dup), Description = "Pagamentos duplicados detectados no período.",               RouteStatus = "DuplicatePayment" },
            new DashboardAlertDto { Type = "paymentWithoutCharge", Count = pwc.Count, LastDetectedAt = Last(pwc), Description = "Pagamentos sem cobrança correspondente detectados.",         RouteStatus = "PaymentWithoutCharge" },
        };
    }
}
