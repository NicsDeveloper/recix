using Microsoft.AspNetCore.Mvc;
using Recix.Application.DTOs;
using Recix.Application.Interfaces;
using Recix.Domain.Enums;

namespace Recix.Api.Endpoints;

public static class PaymentEventEndpoints
{
    public static void MapPaymentEventEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/payment-events").WithTags("Payment Events");

        group.MapGet("/", ListPaymentEvents)
            .WithName("ListPaymentEvents")
            .WithSummary("Lista eventos de pagamento recebidos")
            .Produces<PagedResult<PaymentEventDto>>();
    }

    private static async Task<IResult> ListPaymentEvents(
        IPaymentEventRepository repo,
        [FromQuery] string? status,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        PaymentEventStatus? statusEnum = Enum.TryParse<PaymentEventStatus>(status, true, out var parsed) ? parsed : null;
        var result = await repo.ListAsync(statusEnum, page, pageSize, ct);
        var mapped = new PagedResult<PaymentEventDto>
        {
            Items = result.Items.Select(PaymentEventDto.FromEntity).ToList(),
            TotalCount = result.TotalCount,
            Page = result.Page,
            PageSize = result.PageSize
        };
        return Results.Ok(mapped);
    }
}
