using Microsoft.AspNetCore.Mvc;
using Recix.Application.DTOs;
using Recix.Application.Interfaces;
using Recix.Application.Services;
using Recix.Domain.Enums;

namespace Recix.Api.Endpoints;

public static class ReconciliationEndpoints
{
    public static void MapReconciliationEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/reconciliations").WithTags("Reconciliations");

        group.MapGet("/", ListReconciliations)
            .WithName("ListReconciliations")
            .WithSummary("Lista resultados de conciliação")
            .Produces<PagedResult<ReconciliationDto>>();

        group.MapGet("/enriched", ListEnrichedReconciliations)
            .WithName("ListEnrichedReconciliations")
            .WithSummary("Lista conciliações enriquecidas com referência da cobrança e provedor")
            .Produces<PagedResult<RecentReconciliationDto>>();
    }

    private static async Task<IResult> ListReconciliations(
        IReconciliationRepository repo,
        [FromQuery] string? status,
        [FromQuery] Guid? chargeId,
        [FromQuery] Guid? paymentEventId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        ReconciliationStatus? statusEnum = Enum.TryParse<ReconciliationStatus>(status, true, out var parsed) ? parsed : null;
        var result = await repo.ListAsync(statusEnum, chargeId, paymentEventId, page, pageSize, ct);
        var mapped = new PagedResult<ReconciliationDto>
        {
            Items = result.Items.Select(ReconciliationDto.FromEntity).ToList(),
            TotalCount = result.TotalCount,
            Page = result.Page,
            PageSize = result.PageSize
        };
        return Results.Ok(mapped);
    }

    private static async Task<IResult> ListEnrichedReconciliations(
        DashboardQueryService queryService,
        [FromQuery] string? status,
        [FromQuery] DateTime? fromDate,
        [FromQuery] DateTime? toDate,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        ReconciliationStatus? statusEnum = Enum.TryParse<ReconciliationStatus>(status, true, out var parsed) ? parsed : null;
        var result = await queryService.GetReconciliationsListAsync(statusEnum, fromDate, toDate, page, pageSize, ct);
        return Results.Ok(result);
    }
}
