using Recix.Application.DTOs;
using Recix.Application.Interfaces;
using Recix.Domain.Entities;

namespace Recix.Api.Endpoints;

public static class AlertConfigEndpoints
{
    public static void MapAlertConfigEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/settings/alerts").WithTags("Settings");

        group.MapGet("/", GetAlertConfig)
            .WithName("GetAlertConfig")
            .WithSummary("Retorna a configuração de alertas da organização atual")
            .Produces<AlertConfigDto>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status403Forbidden);

        group.MapPut("/", UpdateAlertConfig)
            .WithName("UpdateAlertConfig")
            .WithSummary("Atualiza a configuração de alertas (webhook URL e eventos habilitados)")
            .Produces<AlertConfigDto>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status400BadRequest)
            .Produces(StatusCodes.Status403Forbidden);
    }

    private static async Task<IResult> GetAlertConfig(
        ICurrentOrganization currentOrg,
        IOrgAlertConfigRepository repo,
        CancellationToken ct)
    {
        if (currentOrg.OrganizationId is null)
            return Results.Forbid();

        var orgId  = currentOrg.OrganizationId.Value;
        var config = await repo.GetByOrgIdAsync(orgId, ct)
                    ?? OrgAlertConfig.Create(orgId);

        return Results.Ok(MapToDto(config));
    }

    private static async Task<IResult> UpdateAlertConfig(
        UpdateAlertConfigRequest request,
        ICurrentOrganization currentOrg,
        IOrgAlertConfigRepository repo,
        CancellationToken ct)
    {
        var isAdmin = currentOrg.Role is "Owner" or "Admin";
        if (!isAdmin || currentOrg.OrganizationId is null)
            return Results.Forbid();

        // Valida URL, se fornecida
        if (!string.IsNullOrWhiteSpace(request.WebhookUrl) &&
            !Uri.TryCreate(request.WebhookUrl, UriKind.Absolute, out var uri) ||
            (!string.IsNullOrWhiteSpace(request.WebhookUrl) &&
             Uri.TryCreate(request.WebhookUrl, UriKind.Absolute, out var u2) &&
             u2.Scheme != "https" && u2.Scheme != "http"))
        {
            return Results.BadRequest(new { error = "WebhookUrl deve ser uma URL válida (http/https)." });
        }

        var orgId  = currentOrg.OrganizationId.Value;
        var config = await repo.GetByOrgIdAsync(orgId, ct)
                    ?? OrgAlertConfig.Create(orgId);

        config.Update(
            request.WebhookUrl,
            request.NotifyAmountMismatch,
            request.NotifyDuplicatePayment,
            request.NotifyPaymentWithoutCharge,
            request.NotifyExpiredChargePaid);

        await repo.UpsertAsync(config, ct);
        return Results.Ok(MapToDto(config));
    }

    private static AlertConfigDto MapToDto(OrgAlertConfig c) => new()
    {
        WebhookUrl                 = c.WebhookUrl,
        NotifyAmountMismatch       = c.NotifyAmountMismatch,
        NotifyDuplicatePayment     = c.NotifyDuplicatePayment,
        NotifyPaymentWithoutCharge = c.NotifyPaymentWithoutCharge,
        NotifyExpiredChargePaid    = c.NotifyExpiredChargePaid,
        UpdatedAt                  = c.UpdatedAt,
    };
}
