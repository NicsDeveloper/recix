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
    }

    private static async Task<IResult> GetSummary(
        DashboardQueryService queryService,
        CancellationToken ct)
    {
        var summary = await queryService.GetSummaryAsync(ct);
        return Results.Ok(summary);
    }
}
