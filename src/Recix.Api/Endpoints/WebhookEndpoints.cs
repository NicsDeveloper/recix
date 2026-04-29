using Microsoft.AspNetCore.Mvc;
using Recix.Application.DTOs;
using Recix.Application.UseCases;

namespace Recix.Api.Endpoints;

public static class WebhookEndpoints
{
    public static void MapWebhookEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/webhooks").WithTags("Webhooks");

        group.MapPost("/pix", ReceivePixWebhook)
            .WithName("ReceivePixWebhook")
            .WithSummary("Recebe um evento de pagamento PIX fake")
            .Produces<ReceivePixWebhookResponse>(StatusCodes.Status202Accepted)
            .Produces<ReceivePixWebhookResponse>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status400BadRequest);
    }

    private static async Task<IResult> ReceivePixWebhook(
        [FromBody] ReceivePixWebhookRequest request,
        ReceivePixWebhookUseCase useCase,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.EventId))
            return Results.BadRequest(new { type = "ValidationError", title = "EventId is required." });

        if (request.PaidAmount <= 0)
            return Results.BadRequest(new { type = "ValidationError", title = "PaidAmount must be greater than zero." });

        if (string.IsNullOrWhiteSpace(request.Provider))
            return Results.BadRequest(new { type = "ValidationError", title = "Provider is required." });

        var response = await useCase.ExecuteAsync(request, ct);

        return response.Status == "IgnoredDuplicate"
            ? Results.Ok(response)
            : Results.Accepted("/webhooks/pix", response);
    }
}
