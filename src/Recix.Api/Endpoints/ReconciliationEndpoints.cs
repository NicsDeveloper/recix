using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Recix.Application.DTOs;
using Recix.Application.Interfaces;
using Recix.Application.Services;
using Recix.Application.UseCases;
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

        group.MapGet("/pending-review", ListPendingReview)
            .WithName("ListPendingReview")
            .WithSummary("Lista conciliações que requerem revisão humana, ordenadas por impacto financeiro")
            .Produces<PendingReviewListDto>()
            .RequireAuthorization();

        group.MapPost("/{id:guid}/confirm", ConfirmMatch)
            .WithName("ConfirmMatch")
            .WithSummary("Confirma um match de baixa confiança — torna-o definitivo")
            .Produces(StatusCodes.Status204NoContent)
            .Produces(StatusCodes.Status404NotFound)
            .RequireAuthorization();

        group.MapPost("/{id:guid}/reject", RejectMatch)
            .WithName("RejectMatch")
            .WithSummary("Rejeita um match — a cobrança volta a Pending e o pagamento é reprocessado")
            .Produces(StatusCodes.Status204NoContent)
            .Produces(StatusCodes.Status404NotFound)
            .RequireAuthorization();
    }

    // ── Handlers ─────────────────────────────────────────────────────────────────

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
            Items      = result.Items.Select(ReconciliationDto.FromEntity).ToList(),
            TotalCount = result.TotalCount,
            Page       = result.Page,
            PageSize   = result.PageSize,
        };
        return Results.Ok(mapped);
    }

    private static async Task<IResult> ListEnrichedReconciliations(
        DashboardQueryService queryService,
        [FromQuery] string? status,
        [FromQuery] bool? divergentOnly,
        [FromQuery] DateTime? fromDate,
        [FromQuery] DateTime? toDate,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        ReconciliationStatus? statusEnum = Enum.TryParse<ReconciliationStatus>(status, true, out var parsed) ? parsed : null;
        var result = await queryService.GetReconciliationsListAsync(
            statusEnum, fromDate, toDate, page, pageSize, ct, divergentOnly is true);
        return Results.Ok(result);
    }

    private static async Task<IResult> ListPendingReview(
        IReconciliationRepository repo,
        HttpContext ctx,
        CancellationToken ct)
    {
        var orgId = GetCurrentOrgId(ctx);
        if (orgId == Guid.Empty) return Results.Unauthorized();

        var items = await repo.ListPendingReviewDtosAsync(orgId, ct);

        var dto = new PendingReviewListDto
        {
            TotalCount = items.Count,
            Items      = items.ToList(),
        };

        return Results.Ok(dto);
    }

    private static async Task<IResult> ConfirmMatch(
        Guid id,
        HttpContext ctx,
        ReviewReconciliationUseCase useCase,
        CancellationToken ct)
    {
        var userId = GetUserId(ctx);
        var orgId  = GetCurrentOrgId(ctx);
        await useCase.ConfirmAsync(id, userId, orgId, ct);
        return Results.NoContent();
    }

    private static async Task<IResult> RejectMatch(
        Guid id,
        HttpContext ctx,
        ReviewReconciliationUseCase useCase,
        CancellationToken ct)
    {
        var userId = GetUserId(ctx);
        var orgId  = GetCurrentOrgId(ctx);
        await useCase.RejectAsync(id, userId, orgId, ct);
        return Results.NoContent();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────────

    private static Guid GetUserId(HttpContext ctx)
    {
        var sub = ctx.User.FindFirst(ClaimTypes.NameIdentifier)?.Value
               ?? ctx.User.FindFirst("sub")?.Value;
        return Guid.TryParse(sub, out var id) ? id : Guid.Empty;
    }

    private static Guid GetCurrentOrgId(HttpContext ctx)
    {
        var claim = ctx.User.FindFirst("org_id")?.Value;
        return Guid.TryParse(claim, out var id) ? id : Guid.Empty;
    }
}
