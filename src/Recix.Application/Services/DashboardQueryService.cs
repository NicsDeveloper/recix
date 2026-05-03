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

        // Intervalo em instantes UTC: início inclusivo, fim exclusivo (cliente envia ISO com fim exclusivo).
        // Importante: se só `toDate` chegar, NÃO usar UtcNow.Date como início — isso corta cobranças criadas antes
        // de “hoje” em UTC e deixa o dashboard zerado com dados existentes na lista.
        var (rangeStart, rangeEndExclusive) = ResolveOverviewChargeRange(fromDate, toDate, now);

        var spanDays = Math.Max(1, (int)Math.Ceiling((rangeEndExclusive - rangeStart).TotalHours / 24.0));
        var prevStart = rangeStart.AddDays(-spanDays);
        var prevEndExclusive = rangeStart;

        // ─── Cobranças do período ─────────────────────────────────────────────────
        var chPage    = await charges.ListAsync(null, rangeStart, rangeEndExclusive, 1, int.MaxValue, ct);
        var chList    = chPage.Items;

        // ─── Conciliações do período ──────────────────────────────────────────────
        var reconPage = await reconciliations.ListAsync(null, null, null, 1, int.MaxValue, ct);
        var reconList = reconPage.Items
            .Where(r => r.CreatedAt >= rangeStart && r.CreatedAt < rangeEndExclusive)
            .ToList();

        // ─── Período anterior ─────────────────────────────────────────────────────
        var prevChPage    = await charges.ListAsync(null, prevStart, prevEndExclusive, 1, int.MaxValue, ct);
        var prevReconPage = await reconciliations.ListAsync(null, null, null, 1, int.MaxValue, ct);
        var prevReconList = prevReconPage.Items
            .Where(r => r.CreatedAt >= prevStart && r.CreatedAt < prevEndExclusive)
            .ToList();

        // Totais do resumo: incluir cobranças referenciadas por conciliações do período (CreatedAt da cobrança pode cair fora do intervalo).
        var mergedCurrent = await MergeChargesWithReconciliationReferencesAsync(chList, reconList, ct);
        var mergedPrev    = await MergeChargesWithReconciliationReferencesAsync(prevChPage.Items, prevReconList, ct);

        var summary     = BuildSummary(mergedCurrent, reconList);
        var prevSummary = BuildSummary(mergedPrev, prevReconList);
        var fluxSeries  = BuildFluxSeries(mergedCurrent, rangeStart, rangeEndExclusive);

        // ─── Últimas conciliações e pagamentos ────────────────────────────────────
        var recentRecon   = await MapRecentReconciliationsAsync(reconList, ct);
        var recentPayment = await MapRecentPaymentEventsAsync(rangeStart, rangeEndExclusive, ct);
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

    /// <summary>Instantes vindos da API em ISO UTC; <see cref="DateTimeKind.Unspecified"/> não é hora local do servidor.</summary>
    private static DateTime AsUtcQueryInstant(DateTime dt) =>
        dt.Kind switch
        {
            DateTimeKind.Utc           => dt,
            DateTimeKind.Local         => dt.ToUniversalTime(),
            DateTimeKind.Unspecified   => DateTime.SpecifyKind(dt, DateTimeKind.Utc),
            _                          => DateTime.SpecifyKind(dt, DateTimeKind.Utc),
        };

    private async Task<IReadOnlyList<Domain.Entities.Charge>> MergeChargesWithReconciliationReferencesAsync(
        IReadOnlyList<Domain.Entities.Charge> chargesCreatedInRange,
        IReadOnlyList<Domain.Entities.ReconciliationResult> reconInRange,
        CancellationToken ct)
    {
        var map = chargesCreatedInRange.DistinctBy(c => c.Id).ToDictionary(c => c.Id);
        var missingIds = reconInRange
            .Select(r => r.ChargeId)
            .Where(id => id.HasValue && !map.ContainsKey(id.Value))
            .Select(id => id!.Value)
            .Distinct()
            .ToList();

        if (missingIds.Count > 0)
        {
            foreach (var c in await charges.GetByIdsAsync(missingIds, ct))
                map[c.Id] = c;
        }

        return map.Values.ToList();
    }

    /// <summary>
    /// Deriva o intervalo de cobranças para o overview. Cobre ausência de um dos limites sem assumir
    /// <see cref="DateTime.UtcNow.Date"/> como início quando só o fim exclusivo veio na query.
    /// </summary>
    private static (DateTime rangeStart, DateTime rangeEndExclusive) ResolveOverviewChargeRange(
        DateTime? fromDate,
        DateTime? toDate,
        DateTime utcNow)
    {
        var fromUtc = fromDate.HasValue ? AsUtcQueryInstant(fromDate.Value) : (DateTime?)null;
        var toUtc   = toDate.HasValue ? AsUtcQueryInstant(toDate.Value) : (DateTime?)null;

        DateTime rangeStart;
        DateTime rangeEndExclusive;

        if (fromUtc.HasValue && toUtc.HasValue)
        {
            rangeStart          = fromUtc.Value;
            rangeEndExclusive   = toUtc.Value;
        }
        else if (fromUtc.HasValue && !toUtc.HasValue)
        {
            rangeStart          = fromUtc.Value;
            rangeEndExclusive   = fromUtc.Value.AddDays(1);
        }
        else if (!fromUtc.HasValue && toUtc.HasValue)
        {
            rangeEndExclusive   = toUtc.Value;
            rangeStart          = rangeEndExclusive.AddDays(-7);
        }
        else
        {
            rangeStart          = utcNow.Date.AddDays(-6);
            rangeEndExclusive   = utcNow.Date.AddDays(1);
        }

        if (rangeEndExclusive < rangeStart)
            (rangeStart, rangeEndExclusive) = (rangeEndExclusive, rangeStart);
        if (rangeEndExclusive <= rangeStart)
            rangeEndExclusive = rangeStart.AddDays(1);

        return (rangeStart, rangeEndExclusive);
    }

    private static DashboardSummaryDto BuildSummary(
        IReadOnlyList<Domain.Entities.Charge> ch,
        IReadOnlyList<Domain.Entities.ReconciliationResult> rc)
    {
        var reconAtt      = SumReconciliationAttentionAmount(rc);
        var pendingReview = rc.Count(r => r.RequiresReview && r.ReviewDecision is null);
        var roll          = ChargeReportingMetrics.Compute(ch);

        return new DashboardSummaryDto
        {
            TotalCharges          = ch.Count,
            PaidCharges           = ch.Count(c => c.Status == ChargeStatus.Paid),
            // PendingReview é "pendente confirmado" — não conta como recebido ainda
            PendingCharges        = ch.Count(c => c.Status is ChargeStatus.Pending
                                                       or ChargeStatus.PendingReview
                                                       or ChargeStatus.PartiallyPaid),
            DivergentCharges      = ch.Count(c => c.Status is ChargeStatus.Divergent or ChargeStatus.Overpaid),
            ExpiredCharges        = ch.Count(c => c.Status == ChargeStatus.Expired),
            // Apenas Paid — MatchedLowConfidence não confirmado NÃO conta como recebido
            TotalExpectedAmount   = roll.ExpectedTotal,
            TotalReceivedAmount   = roll.ReceivedFromPaidTotal,
            TotalDivergentAmount  = roll.DivergentChargeTotal,
            TotalReconciliationAttentionAmount = reconAtt,
            PendingReviewCount    = pendingReview,
            ReconciliationIssues  = new ReconciliationIssuesDto
            {
                Matched                 = rc.Count(r => r.Status == ReconciliationStatus.Matched),
                MatchedLowConfidence    = rc.Count(r => r.Status == ReconciliationStatus.MatchedLowConfidence),
                AmountMismatch          = rc.Count(r => r.Status == ReconciliationStatus.AmountMismatch),
                PartialPayment          = rc.Count(r => r.Status == ReconciliationStatus.PartialPayment),
                PaymentExceedsExpected  = rc.Count(r => r.Status == ReconciliationStatus.PaymentExceedsExpected),
                DuplicatePayment        = rc.Count(r => r.Status == ReconciliationStatus.DuplicatePayment),
                PaymentWithoutCharge    = rc.Count(r => r.Status == ReconciliationStatus.PaymentWithoutCharge),
                ChargeWithoutPayment     = rc.Count(r => r.Status == ReconciliationStatus.ChargeWithoutPayment),
                MultipleMatchCandidates = rc.Count(r => r.Status == ReconciliationStatus.MultipleMatchCandidates),
                ExpiredChargePaid       = rc.Count(r => r.Status == ReconciliationStatus.ExpiredChargePaid),
                InvalidReference        = rc.Count(r => r.Status == ReconciliationStatus.InvalidReference),
                ProcessingError         = rc.Count(r => r.Status == ReconciliationStatus.ProcessingError),
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
                case ReconciliationStatus.PaymentExceedsExpected:
                    sum += r.PaidAmount;
                    break;
                case ReconciliationStatus.PaymentWithoutCharge:
                case ReconciliationStatus.DuplicatePayment:
                case ReconciliationStatus.ExpiredChargePaid:
                case ReconciliationStatus.MultipleMatchCandidates:
                    sum += r.PaidAmount;
                    break;
                case ReconciliationStatus.ChargeWithoutPayment:
                    // Valor esperado que nunca chegou → exposição é o valor da cobrança
                    sum += r.ExpectedAmount ?? 0;
                    break;
                case ReconciliationStatus.InvalidReference:
                case ReconciliationStatus.ProcessingError:
                    sum += r.PaidAmount;
                    break;
                // MatchedLowConfidence não entra na atenção — é revisão, não divergência confirmada
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

        var div  = ch.Where(c => c.Status is ChargeStatus.Divergent or ChargeStatus.Overpaid)
                     .Select(c => (at: c.UpdatedAt ?? c.CreatedAt, c.Amount))
                     .Where(x => x.at >= rangeStart && x.at < rangeEnd).ToList();

        // "Esperado" na série = mesmo conceito do KPI: soma cumulativa (por data de criação) das cobranças não canceladas no intervalo.
        var expectedByCreation = ch.Where(c => c.Status != ChargeStatus.Cancelled)
            .Select(c => (at: c.CreatedAt, c.Amount))
            .Where(x => x.at >= rangeStart && x.at < rangeEnd)
            .ToList();

        return Enumerable.Range(0, buckets).Select(i =>
        {
            var t        = rangeStart + step * i;
            var received = paid.Where(x => x.at <= t).Sum(x => x.Amount);
            var diverged = div.Where(x => x.at <= t).Sum(x => x.Amount);
            var expected = expectedByCreation.Where(x => x.at <= t).Sum(x => x.Amount);
            return new FluxSeriesPointDto
            {
                Label    = isHourly ? t.ToString("HH:mm") : t.ToString("dd/MM"),
                Received = received,
                Expected = expected,
                Divergent = diverged,
            };
        }).ToList();
    }

    private static readonly ReconciliationStatus[] DivergentStatuses =
    [
        ReconciliationStatus.AmountMismatch,
        ReconciliationStatus.PaymentExceedsExpected,
        ReconciliationStatus.DuplicatePayment,
        ReconciliationStatus.PaymentWithoutCharge,
        ReconciliationStatus.ChargeWithoutPayment,
        ReconciliationStatus.MultipleMatchCandidates,
        ReconciliationStatus.ExpiredChargePaid,
        ReconciliationStatus.InvalidReference,
        ReconciliationStatus.ProcessingError,
        // MatchedLowConfidence não é "divergência" — vai para a aba Revisão
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
            filtered = filtered.Where(r => r.CreatedAt >= fromDate.Value.ToUniversalTime());
        if (toDate.HasValue)
            filtered = filtered.Where(r => r.CreatedAt < toDate.Value.ToUniversalTime());

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
                ChargeId          = r.ChargeId,
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
        var rangeStart = AsUtcQueryInstant(from);
        var rangeEndExclusive = AsUtcQueryInstant(to);
        if (rangeEndExclusive < rangeStart)
            (rangeStart, rangeEndExclusive) = (rangeEndExclusive, rangeStart);
        if (rangeEndExclusive <= rangeStart)
            rangeEndExclusive = rangeStart.AddDays(1);

        var chPage    = await charges.ListAsync(null, rangeStart, rangeEndExclusive, 1, int.MaxValue, ct);
        var ch        = chPage.Items;
        var reconPage = await reconciliations.ListAsync(null, null, null, 1, int.MaxValue, ct);
        var rc        = reconPage.Items
            .Where(r => r.CreatedAt >= rangeStart && r.CreatedAt < rangeEndExclusive)
            .ToList();

        var mergedCh = await MergeChargesWithReconciliationReferencesAsync(ch, rc, ct);

        var paid     = mergedCh.Where(c => c.Status == ChargeStatus.Paid).ToList();
        var divg     = mergedCh.Where(c => c.Status is ChargeStatus.Divergent or ChargeStatus.Overpaid).ToList();
        var pending  = mergedCh.Where(c => c.Status is ChargeStatus.Pending
                                       or ChargeStatus.PendingReview
                                       or ChargeStatus.PartiallyPaid).ToList();

        var roll      = ChargeReportingMetrics.Compute(mergedCh);
        var expected  = roll.ExpectedTotal;
        var received  = roll.ReceivedFromPaidTotal;
        var divergent = roll.DivergentChargeTotal;
        var pendAmt   = roll.PendingOperationalTotal;
        var recovery  = expected > 0 ? Math.Round(received / expected * 100, 2) : 0m;

        // Cobranças sem nenhuma conciliação no período
        var reconciledChargeIds = rc.Where(r => r.ChargeId.HasValue)
                                    .Select(r => r.ChargeId!.Value)
                                    .ToHashSet();

        var unreconciled = ch
            .Where(c => (c.Status is ChargeStatus.Pending or ChargeStatus.Expired)
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
            From             = rangeStart,
            To               = rangeEndExclusive.AddTicks(-1),
            TotalCharges     = mergedCh.Count,
            PaidCharges      = paid.Count,
            PendingCharges   = pending.Count,
            DivergentCharges = divg.Count,
            ExpiredCharges   = mergedCh.Count(c => c.Status == ChargeStatus.Expired),
            ExpectedAmount   = expected,
            ReceivedAmount   = received,
            DivergentAmount  = divergent,
            PendingAmount    = pendAmt,
            RecoveryRate     = recovery,
            ReconciliationsTotal                = rc.Count,
            ReconciliationsMatched              = rc.Count(r => r.Status == ReconciliationStatus.Matched),
            ReconciliationsMatchedLowConfidence = rc.Count(r => r.Status == ReconciliationStatus.MatchedLowConfidence),
            ReconciliationsAmountMismatch       = rc.Count(r => r.Status == ReconciliationStatus.AmountMismatch),
            ReconciliationsPartialPayment       = rc.Count(r => r.Status == ReconciliationStatus.PartialPayment),
            ReconciliationsPaymentExceedsExpected = rc.Count(r => r.Status == ReconciliationStatus.PaymentExceedsExpected),
            ReconciliationsDuplicate            = rc.Count(r => r.Status == ReconciliationStatus.DuplicatePayment),
            ReconciliationsNoCharge             = rc.Count(r => r.Status == ReconciliationStatus.PaymentWithoutCharge),
            ReconciliationsChargeWithoutPayment = rc.Count(r => r.Status == ReconciliationStatus.ChargeWithoutPayment),
            ReconciliationsMultipleMatch        = rc.Count(r => r.Status == ReconciliationStatus.MultipleMatchCandidates),
            ReconciliationsExpiredPaid          = rc.Count(r => r.Status == ReconciliationStatus.ExpiredChargePaid),
            ReconciliationsInvalidRef           = rc.Count(r => r.Status == ReconciliationStatus.InvalidReference),
            ReconciliationsError                = rc.Count(r => r.Status == ReconciliationStatus.ProcessingError),
            Unreconciled     = unreconciled,
        };
    }

    /// <summary>Rótulos de auditoria por cobrança (para badges na lista operacional).</summary>
    public async Task<IReadOnlyDictionary<Guid, string>> GetReconciliationAggregateLabelsForChargesAsync(
        IReadOnlyList<Guid> chargeIds,
        CancellationToken ct = default)
    {
        if (chargeIds.Count == 0)
            return new Dictionary<Guid, string>();

        var rows      = await reconciliations.ListByChargeIdsAsync(chargeIds, ct);
        var allocSums = await reconciliations.SumRecognizedAllocationsByChargeIdsAsync(chargeIds, ct);
        var groups    = rows.GroupBy(r => r.ChargeId!.Value).ToDictionary(g => g.Key, g => (IReadOnlyList<Domain.Entities.ReconciliationResult>)g.ToList());
        var map       = new Dictionary<Guid, string>();

        foreach (var id in chargeIds)
        {
            groups.TryGetValue(id, out var list);
            list ??= [];
            if (list.Count == 0 && (!allocSums.TryGetValue(id, out var onlyAlloc) || onlyAlloc <= 0m))
                continue;

            var charge   = await charges.GetByIdAsync(id, ct);
            var expected = charge?.Amount ?? list.FirstOrDefault()?.ExpectedAmount ?? 0;
            var fromAlloc = allocSums.TryGetValue(id, out var sum) ? sum : 0m;
            map[id] = ReconciliationAggregateClassifier.Classify(expected, list, fromAlloc);
        }

        return map;
    }

    /// <summary>Uma linha por cobrança no período (eventos de pagamento agregados).</summary>
    public async Task<PagedResult<ChargeReconciliationSummaryDto>> GetChargeReconciliationSummariesAsync(
        DateTime? fromDate,
        DateTime? toDate,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        var rangeStart = (fromDate ?? now.AddDays(-6)).ToUniversalTime();
        var rangeEndExclusive = (toDate ?? now).ToUniversalTime();
        if (rangeEndExclusive < rangeStart)
            (rangeStart, rangeEndExclusive) = (rangeEndExclusive, rangeStart);
        if (rangeEndExclusive <= rangeStart)
            rangeEndExclusive = rangeStart.AddDays(1);

        var reconPage = await reconciliations.ListAsync(null, null, null, 1, int.MaxValue, ct);
        var inRange = reconPage.Items
            .Where(r => r.CreatedAt >= rangeStart && r.CreatedAt < rangeEndExclusive && r.ChargeId.HasValue)
            .ToList();

        var groups = inRange
            .GroupBy(r => r.ChargeId!.Value)
            .OrderByDescending(g => g.Max(x => x.CreatedAt))
            .ToList();

        var total = groups.Count;
        var slice = groups.Skip((page - 1) * pageSize).Take(pageSize).ToList();
        var items = new List<ChargeReconciliationSummaryDto>();

        var sliceChargeIds = slice.Select(x => x.Key).ToList();
        var allocSumsPage  = await reconciliations.SumRecognizedAllocationsByChargeIdsAsync(sliceChargeIds, ct);

        foreach (var g in slice)
        {
            var list = g.OrderByDescending(x => x.CreatedAt).ToList();
            var charge   = await charges.GetByIdAsync(g.Key, ct);
            var expected = charge?.Amount ?? list[0].ExpectedAmount ?? 0;
            var fromAlloc = allocSumsPage.TryGetValue(g.Key, out var s) ? s : 0m;
            var allocated = ReconciliationAggregateClassifier.SumAllocatedTowardCharge(list, fromAlloc);
            var status    = ReconciliationAggregateClassifier.Classify(expected, list, fromAlloc);
            var lines     = await EnrichReconciliationsAsync(list, ct);
            var refId     = charge?.ReferenceId ?? lines.FirstOrDefault()?.ChargeReferenceId ?? "";

            items.Add(new ChargeReconciliationSummaryDto
            {
                ChargeId            = g.Key,
                ChargeReferenceId   = refId,
                ExpectedAmount      = expected,
                TotalPaidAllocated  = allocated,
                NetDifference       = allocated - expected,
                AggregateStatus     = status,
                LastEventAt         = list.Max(x => x.CreatedAt),
                PaymentLines        = lines,
            });
        }

        return new PagedResult<ChargeReconciliationSummaryDto>
        {
            Items      = items,
            TotalCount = total,
            Page       = page,
            PageSize   = pageSize,
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
