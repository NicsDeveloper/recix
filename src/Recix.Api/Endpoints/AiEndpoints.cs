using Microsoft.AspNetCore.Mvc;
using Recix.Application.Interfaces;

namespace Recix.Api.Endpoints;

public static class AiEndpoints
{
    public static void MapAiEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/ai").WithTags("AI Insights");

        group.MapGet("/reconciliations/{id:guid}/explanation", ExplainReconciliation)
            .WithName("ExplainReconciliation")
            .WithSummary("Retorna explicação em linguagem natural para uma conciliação (IA fake)")
            .Produces<object>()
            .Produces(StatusCodes.Status404NotFound);

        group.MapGet("/summary/daily", GetDailySummary)
            .WithName("GetDailySummary")
            .WithSummary("Retorna resumo diário gerado por IA fake")
            .Produces<object>();
    }

    private static async Task<IResult> ExplainReconciliation(
        Guid id,
        IAiInsightService aiService,
        CancellationToken ct)
    {
        var result = await aiService.ExplainReconciliationAsync(id, ct);
        return Results.Ok(result);
    }

    private static async Task<IResult> GetDailySummary(
        IAiInsightService aiService,
        [FromQuery] DateTime? date,
        CancellationToken ct)
    {
        var targetDate = date ?? DateTime.UtcNow.Date;
        var result = await aiService.GenerateDailySummaryAsync(targetDate, ct);
        return Results.Ok(result);
    }
}
