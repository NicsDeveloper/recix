using Microsoft.AspNetCore.Mvc;
using Recix.Application.DTOs;
using Recix.Application.Interfaces;
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
}
