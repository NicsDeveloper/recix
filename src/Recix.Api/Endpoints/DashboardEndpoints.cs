using Microsoft.AspNetCore.Mvc;
using Recix.Application.DTOs;
using Recix.Application.Services;

namespace Recix.Api.Endpoints;

public static class DashboardEndpoints
{
    public static void MapDashboardEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/dashboard").WithTags("Dashboard");

        group.MapGet("/summary", GetSummary)
            .WithName("GetDashboardSummary")
            .WithSummary("Retorna resumo financeiro geral")
            .Produces<DashboardSummaryDto>();

        group.MapGet("/overview", GetOverview)
            .WithName("GetDashboardOverview")
            .WithSummary("Retorna dados completos do Dashboard da UI")
            .Produces<DashboardOverviewDto>();

        group.MapGet("/closing-report", GetClosingReport)
            .WithName("GetClosingReport")
            .WithSummary("Relatório de fechamento do período: esperado vs recebido vs divergente")
            .Produces<ClosingReportDto>();

        group.MapGet("/charge-reconciliation-summaries", GetChargeReconciliationSummaries)
            .WithName("GetChargeReconciliationSummaries")
            .WithSummary("Auditoria por cobrança: soma de pagamentos, diferença e linhas de evento no período")
            .Produces<PagedResult<ChargeReconciliationSummaryDto>>();
    }

    private static async Task<IResult> GetSummary(
        DashboardQueryService queryService,
        CancellationToken ct)
    {
        var summary = await queryService.GetSummaryAsync(ct);
        return Results.Ok(summary);
    }

    private static async Task<IResult> GetOverview(
        DashboardQueryService queryService,
        [FromQuery] DateTime? fromDate,
        [FromQuery] DateTime? toDate,
        CancellationToken ct)
    {
        var overview = await queryService.GetOverviewAsync(fromDate, toDate, ct);
        return Results.Ok(overview);
    }

    private static async Task<IResult> GetClosingReport(
        DashboardQueryService queryService,
        [FromQuery] DateTime? fromDate,
        [FromQuery] DateTime? toDate,
        CancellationToken ct)
    {
        var now  = DateTime.UtcNow;
        var from = fromDate ?? now.AddDays(-6);
        var to   = toDate   ?? now;
        var report = await queryService.GetClosingReportAsync(from, to, ct);
        return Results.Ok(report);
    }

    private static async Task<IResult> GetChargeReconciliationSummaries(
        DashboardQueryService queryService,
        [FromQuery] DateTime? fromDate,
        [FromQuery] DateTime? toDate,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        var result = await queryService.GetChargeReconciliationSummariesAsync(fromDate, toDate, page, pageSize, ct);
        return Results.Ok(result);
    }
}
