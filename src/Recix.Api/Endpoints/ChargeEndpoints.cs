using Microsoft.AspNetCore.Mvc;
using Recix.Application.DTOs;
using Recix.Application.UseCases;
using Recix.Application.Interfaces;
using Recix.Application.Services;
using Recix.Domain.Enums;

namespace Recix.Api.Endpoints;

public static class ChargeEndpoints
{
    public static void MapChargeEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/charges").WithTags("Charges");

        group.MapPost("/", CreateCharge)
            .WithName("CreateCharge")
            .WithSummary("Cria uma nova cobrança PIX fake")
            .Produces<CreateChargeResponse>(StatusCodes.Status201Created)
            .Produces(StatusCodes.Status400BadRequest);

        group.MapGet("/", ListCharges)
            .WithName("ListCharges")
            .WithSummary("Lista cobranças com paginação e filtros")
            .Produces<PagedResult<ChargeDto>>();

        group.MapGet("/{id:guid}", GetCharge)
            .WithName("GetCharge")
            .WithSummary("Retorna detalhes de uma cobrança")
            .Produces<ChargeDto>()
            .Produces(StatusCodes.Status404NotFound);

        group.MapPost("/{id:guid}/cancel", CancelCharge)
            .WithName("CancelCharge")
            .WithSummary("Cancela uma cobrança ainda pendente (sem pagamento)")
            .Produces(StatusCodes.Status204NoContent)
            .Produces(StatusCodes.Status400BadRequest)
            .Produces(StatusCodes.Status404NotFound);
    }

    private static async Task<IResult> CreateCharge(
        [FromBody] CreateChargeRequest request,
        CreateChargeUseCase useCase,
        CancellationToken ct)
    {
        var response = await useCase.ExecuteAsync(request, ct);
        return Results.Created($"/charges/{response.Id}", response);
    }

    private static async Task<IResult> ListCharges(
        IChargeRepository repo,
        DashboardQueryService dashboardQuery,
        [FromQuery] string? status,
        [FromQuery] DateTime? fromDate,
        [FromQuery] DateTime? toDate,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        ChargeStatus? statusEnum = Enum.TryParse<ChargeStatus>(status, true, out var parsed) ? parsed : null;
        var result = await repo.ListAsync(statusEnum, fromDate, toDate, page, pageSize, ct);
        var labels = await dashboardQuery.GetReconciliationAggregateLabelsForChargesAsync(
            result.Items.Select(c => c.Id).ToList(), ct);
        var mapped = new PagedResult<ChargeDto>
        {
            Items = result.Items
                .Select(c => ChargeDto.FromEntity(c, labels.GetValueOrDefault(c.Id)))
                .ToList(),
            TotalCount = result.TotalCount,
            Page = result.Page,
            PageSize = result.PageSize
        };
        return Results.Ok(mapped);
    }

    private static async Task<IResult> GetCharge(
        Guid id,
        IChargeRepository repo,
        CancellationToken ct)
    {
        var charge = await repo.GetByIdAsync(id, ct)
            ?? throw new KeyNotFoundException($"Charge {id} not found.");
        return Results.Ok(ChargeDto.FromEntity(charge));
    }

    private static async Task<IResult> CancelCharge(
        Guid id,
        CancelChargeUseCase useCase,
        CancellationToken ct)
    {
        await useCase.ExecuteAsync(id, ct);
        return Results.NoContent();
    }
}
