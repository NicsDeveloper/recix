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
}
