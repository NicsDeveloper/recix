using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using Recix.Application.DTOs;
using Recix.Application.Interfaces;
using Recix.Application.UseCases;
using Recix.Infrastructure.Services;

namespace Recix.Api.Endpoints;

public static class WebhookEndpoints
{
    public static void MapWebhookEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/webhooks").WithTags("Webhooks");

        // Endpoint fake — usado pelo simulador do frontend e pelos testes
        group.MapPost("/pix", ReceivePixWebhook)
            .WithName("ReceivePixWebhook")
            .WithSummary("Recebe um evento de pagamento PIX (simulador / fake)")
            .Produces<ReceivePixWebhookResponse>(StatusCodes.Status202Accepted)
            .Produces<ReceivePixWebhookResponse>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status400BadRequest)
            .Produces(StatusCodes.Status403Forbidden)
            .RequireAuthorization();

        // Endpoint real — chamado pela EfiBank quando um pagamento é confirmado
        group.MapPost("/efibank", ReceiveEfiBankWebhook)
            .WithName("ReceiveEfiBankWebhook")
            .WithSummary("Endpoint de webhook real da EfiBank (PIX confirmado)")
            .Produces(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status400BadRequest)
            .Produces(StatusCodes.Status401Unauthorized)
            .AllowAnonymous();
    }

    // ─── Fake / Simulator ────────────────────────────────────────────────────

    private static async Task<IResult> ReceivePixWebhook(
        [FromBody] ReceivePixWebhookRequest request,
        ICurrentOrganization currentOrg,
        ReceivePixWebhookUseCase useCase,
        CancellationToken ct)
    {
        var isAdmin = currentOrg.Role is "Owner" or "Admin";
        if (!isAdmin)
            return Results.Forbid();

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

    // ─── EfiBank Real ────────────────────────────────────────────────────────

    private static async Task<IResult> ReceiveEfiBankWebhook(
        HttpContext ctx,
        ReceivePixWebhookUseCase useCase,
        IOptions<EfiBankOptions> optionsAccessor,
        CancellationToken ct)
    {
        var options = optionsAccessor.Value;

        // Validação mTLS opcional (recomendado em produção)
        if (options.ValidateWebhookMtls)
        {
            var cert = ctx.Connection.ClientCertificate;
            if (cert is null)
            {
                return Results.Unauthorized();
            }
            // Em produção: validar thumbprint/issuer contra certificados conhecidos da EfiBank
            // Consulte: https://dev.efipay.com.br/docs/api-pix/webhooks
        }

        string rawBody;
        using (var reader = new StreamReader(ctx.Request.Body))
            rawBody = await reader.ReadToEndAsync(ct);

        if (string.IsNullOrWhiteSpace(rawBody))
            return Results.BadRequest(new { type = "ValidationError", title = "Empty body." });

        IEnumerable<ReceivePixWebhookRequest> events;
        try
        {
            events = EfiBankWebhookAdapter.Adapt(rawBody).ToList();
        }
        catch (Exception ex)
        {
            return Results.BadRequest(new { type = "ParseError", title = $"Failed to parse EfiBank payload: {ex.Message}" });
        }

        foreach (var request in events)
        {
            await useCase.ExecuteAsync(request, ct);
        }

        // EfiBank espera HTTP 200 para confirmar recebimento
        return Results.Ok();
    }
}
