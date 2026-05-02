using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Recix.Application.DTOs;
using Recix.Application.Interfaces;
using Recix.Application.UseCases;
using Recix.Domain.Enums;

namespace Recix.Api.Endpoints;

public static class OrganizationEndpoints
{
    public static void MapOrganizationEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/organizations").WithTags("Organizations");

        group.MapGet("/mine", GetMyOrgs)
            .WithName("GetMyOrganizations")
            .WithSummary("Lista todas as organizações do usuário autenticado")
            .Produces<List<OrgMembershipDto>>();

        group.MapPost("/switch", SwitchOrg)
            .WithName("SwitchOrganization")
            .WithSummary("Troca a organização ativa e retorna um novo JWT")
            .Produces<AuthResponse>()
            .Produces(StatusCodes.Status401Unauthorized);

        group.MapGet("/current", GetCurrent)
            .WithName("GetCurrentOrganization")
            .WithSummary("Retorna detalhes da organização ativa no token")
            .Produces<OrganizationDto>()
            .Produces(StatusCodes.Status404NotFound);

        group.MapGet("/search", SearchOrgs)
            .WithName("SearchOrganizations")
            .WithSummary("Busca organizações por nome ou slug (usado no registro)")
            .Produces<List<OrgSearchDto>>()
            .AllowAnonymous();

        group.MapPost("/setup/create", SetupCreateOrg)
            .WithName("SetupCreateOrg")
            .WithSummary("Cria uma nova organização para o usuário autenticado sem org")
            .Produces<AuthResponse>()
            .RequireAuthorization();

        group.MapPost("/setup/join", SetupJoinOrg)
            .WithName("SetupJoinOrg")
            .WithSummary("Solicita entrada em uma organização existente")
            .Produces<AuthResponse>()
            .RequireAuthorization();

        group.MapGet("/members", GetMembers)
            .WithName("GetOrganizationMembers")
            .WithSummary("Lista membros da organização atual")
            .Produces<List<MemberDto>>()
            .RequireAuthorization();

        group.MapPatch("/members/{userId:guid}/role", UpdateMemberRole)
            .WithName("UpdateMemberRole")
            .WithSummary("Altera o papel de um membro na organização")
            .Produces<MemberDto>()
            .Produces(StatusCodes.Status404NotFound)
            .RequireAuthorization();

        group.MapDelete("/members/{userId:guid}", RemoveMember)
            .WithName("RemoveMember")
            .WithSummary("Remove um membro da organização")
            .Produces(StatusCodes.Status204NoContent)
            .Produces(StatusCodes.Status403Forbidden)
            .RequireAuthorization();

        group.MapGet("/join-requests/pending", GetPendingJoinRequests)
            .WithName("GetPendingJoinRequests")
            .WithSummary("Lista solicitações de acesso pendentes na org atual")
            .Produces<List<JoinRequestDto>>();

        group.MapGet("/join-requests/pending/count", GetPendingJoinRequestCount)
            .WithName("GetPendingJoinRequestCount")
            .WithSummary("Contagem de solicitações pendentes (para badge de notificação)")
            .Produces<int>();

        group.MapPut("/join-requests/{id:guid}/accept", AcceptJoinRequest)
            .WithName("AcceptJoinRequest")
            .WithSummary("Aceita a solicitação de acesso")
            .Produces<JoinRequestDto>()
            .Produces(StatusCodes.Status404NotFound);

        group.MapPut("/join-requests/{id:guid}/reject", RejectJoinRequest)
            .WithName("RejectJoinRequest")
            .WithSummary("Rejeita a solicitação de acesso")
            .Produces<JoinRequestDto>()
            .Produces(StatusCodes.Status404NotFound);
    }

    // ─── Handlers ────────────────────────────────────────────────────────────

    private static async Task<IResult> GetMyOrgs(
        HttpContext ctx,
        IOrganizationRepository orgs,
        CancellationToken ct)
    {
        var userId = GetUserId(ctx);
        var memberships = await orgs.GetMembershipsAsync(userId, ct);

        var currentOrgId = GetCurrentOrgId(ctx);

        var dtos = memberships.Select(m => new OrgMembershipDto
        {
            OrgId     = m.OrganizationId,
            Name      = m.Organization.Name,
            Slug      = m.Organization.Slug,
            Role      = m.Role,
            IsCurrent = m.OrganizationId == currentOrgId,
        }).ToList();

        return Results.Ok(dtos);
    }

    private static async Task<IResult> SwitchOrg(
        [FromBody] SwitchOrgRequest request,
        HttpContext ctx,
        SwitchOrgUseCase useCase,
        CancellationToken ct)
    {
        var userId   = GetUserId(ctx);
        var response = await useCase.ExecuteAsync(userId, request.OrganizationId, ct);
        return Results.Ok(response);
    }

    private static async Task<IResult> GetCurrent(
        HttpContext ctx,
        IOrganizationRepository orgs,
        CancellationToken ct)
    {
        var orgId = GetCurrentOrgId(ctx);
        if (orgId == Guid.Empty) return Results.NotFound();

        var org = await orgs.GetByIdAsync(orgId, ct);
        if (org is null) return Results.NotFound();

        return Results.Ok(new OrganizationDto
        {
            Id          = org.Id,
            Name        = org.Name,
            Slug        = org.Slug,
            Plan        = org.Plan,
            MemberCount = org.Members.Count,
            CreatedAt   = org.CreatedAt,
        });
    }

    private static async Task<IResult> SearchOrgs(
        [FromQuery] string q,
        IOrganizationRepository orgs,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(q) || q.Length < 2)
            return Results.Ok(new List<OrgSearchDto>());

        var results = await orgs.SearchAsync(q, ct);
        return Results.Ok(results.Select(r => new OrgSearchDto
        {
            Id          = r.Id,
            Name        = r.Name,
            Slug        = r.Slug,
            MemberCount = r.MemberCount,
        }).ToList());
    }

    private static async Task<IResult> SetupCreateOrg(
        [FromBody] SetupCreateOrgBody body,
        HttpContext ctx,
        OrgSetupUseCase useCase,
        CancellationToken ct)
    {
        var userId = GetUserId(ctx);
        var result = await useCase.CreateOrgAsync(userId, body.OrgName, ct);
        return Results.Ok(result);
    }

    private static async Task<IResult> SetupJoinOrg(
        [FromBody] SetupJoinOrgBody body,
        HttpContext ctx,
        OrgSetupUseCase useCase,
        CancellationToken ct)
    {
        var userId = GetUserId(ctx);
        var result = await useCase.RequestJoinAsync(userId, body.OrgId, body.Message, ct);
        return Results.Ok(result);
    }

    private sealed record SetupCreateOrgBody(string OrgName);
    private sealed record SetupJoinOrgBody(Guid OrgId, string? Message);

    private static async Task<IResult> GetMembers(
        HttpContext ctx,
        IOrganizationRepository orgs,
        CancellationToken ct)
    {
        var orgId   = GetCurrentOrgId(ctx);
        if (orgId == Guid.Empty) return Results.Unauthorized();

        var members = await orgs.GetMembersByOrgAsync(orgId, ct);
        var dtos = members.Select(m => new MemberDto
        {
            UserId   = m.UserId,
            Name     = m.User?.Name ?? "",
            Email    = m.User?.Email ?? "",
            Role     = m.Role,
            JoinedAt = m.JoinedAt,
        }).ToList();

        return Results.Ok(dtos);
    }

    private static async Task<IResult> UpdateMemberRole(
        Guid userId,
        [FromBody] UpdateMemberRoleBody body,
        HttpContext ctx,
        IOrganizationRepository orgs,
        CancellationToken ct)
    {
        var orgId      = GetCurrentOrgId(ctx);
        var requesterId = GetUserId(ctx);

        if (userId == requesterId)
            return Results.BadRequest("Você não pode alterar seu próprio papel.");

        if (body.Role is not (OrgRoles.Admin or OrgRoles.Member or OrgRoles.Viewer))
            return Results.BadRequest($"Role inválido: '{body.Role}'.");

        var member = await orgs.GetMembershipAsync(orgId, userId, ct);
        if (member is null) return Results.NotFound("Membro não encontrado.");

        if (member.Role == OrgRoles.Owner)
            return Results.BadRequest("O papel do proprietário não pode ser alterado.");

        member.ChangeRole(body.Role);
        await orgs.UpdateMemberAsync(member, ct);

        return Results.Ok(new MemberDto
        {
            UserId   = member.UserId,
            Name     = member.User?.Name ?? "",
            Email    = member.User?.Email ?? "",
            Role     = member.Role,
            JoinedAt = member.JoinedAt,
        });
    }

    private static async Task<IResult> RemoveMember(
        Guid userId,
        HttpContext ctx,
        IOrganizationRepository orgs,
        CancellationToken ct)
    {
        var orgId      = GetCurrentOrgId(ctx);
        var requesterId = GetUserId(ctx);

        if (userId == requesterId)
            return Results.BadRequest("Você não pode se remover da organização.");

        var member = await orgs.GetMembershipAsync(orgId, userId, ct);
        if (member is null) return Results.NotFound("Membro não encontrado.");

        if (member.Role == OrgRoles.Owner)
            return Results.Forbid();

        await orgs.RemoveMemberAsync(member, ct);
        return Results.NoContent();
    }

    private sealed record UpdateMemberRoleBody(string Role);

    private static async Task<IResult> GetPendingJoinRequests(
        HttpContext ctx,
        IOrganizationJoinRequestRepository joinRequests,
        IUserRepository users,
        IOrganizationRepository orgs,
        CancellationToken ct)
    {
        var orgId = GetCurrentOrgId(ctx);
        if (orgId == Guid.Empty) return Results.Unauthorized();

        var pending = await joinRequests.ListPendingByOrgAsync(orgId, ct);
        var org     = await orgs.GetByIdAsync(orgId, ct);

        var dtos = pending.Select(r => new JoinRequestDto
        {
            Id          = r.Id,
            OrgId       = r.OrganizationId,
            OrgName     = org?.Name ?? "",
            OrgSlug     = org?.Slug ?? "",
            UserId      = r.UserId,
            UserName    = r.User.Name,
            UserEmail   = r.User.Email,
            Status      = r.Status.ToString(),
            Message     = r.Message,
            RequestedAt = r.RequestedAt,
            ReviewedAt  = r.ReviewedAt,
        }).ToList();

        return Results.Ok(dtos);
    }

    private static async Task<IResult> GetPendingJoinRequestCount(
        HttpContext ctx,
        IOrganizationJoinRequestRepository joinRequests,
        CancellationToken ct)
    {
        var orgId = GetCurrentOrgId(ctx);
        if (orgId == Guid.Empty) return Results.Ok(0);

        var count = await joinRequests.CountPendingByOrgAsync(orgId, ct);
        return Results.Ok(count);
    }

    private static async Task<IResult> AcceptJoinRequest(
        Guid id,
        [FromBody] AcceptJoinRequestBody? body,
        HttpContext ctx,
        ReviewJoinRequestUseCase useCase,
        CancellationToken ct)
    {
        var reviewerId = GetUserId(ctx);
        var orgId      = GetCurrentOrgId(ctx);
        var result     = await useCase.ExecuteAsync(id, reviewerId, orgId, accept: true, ct, body?.Role);
        return Results.Ok(result);
    }

    private sealed record AcceptJoinRequestBody(string? Role);

    private static async Task<IResult> RejectJoinRequest(
        Guid id,
        HttpContext ctx,
        ReviewJoinRequestUseCase useCase,
        CancellationToken ct)
    {
        var reviewerId = GetUserId(ctx);
        var orgId      = GetCurrentOrgId(ctx);
        var result     = await useCase.ExecuteAsync(id, reviewerId, orgId, accept: false, ct);
        return Results.Ok(result);
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

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
