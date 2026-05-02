using Microsoft.AspNetCore.Mvc;
using Recix.Application.DTOs;
using Recix.Application.UseCases;
using System.Security.Claims;

namespace Recix.Api.Endpoints;

public static class AuthEndpoints
{
    public static void MapAuthEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/auth").WithTags("Auth");

        group.MapPost("/register", Register)
            .WithName("Register")
            .WithSummary("Cria uma nova conta com e-mail e senha")
            .Produces<AuthResponse>(StatusCodes.Status201Created)
            .Produces(StatusCodes.Status400BadRequest)
            .AllowAnonymous();

        group.MapPost("/login", Login)
            .WithName("Login")
            .WithSummary("Autentica com e-mail e senha, retorna JWT")
            .Produces<AuthResponse>()
            .Produces(StatusCodes.Status401Unauthorized)
            .AllowAnonymous();

        group.MapPost("/google", GoogleAuth)
            .WithName("GoogleAuth")
            .WithSummary("Autentica com Google Identity Services (credential token), retorna JWT")
            .Produces<AuthResponse>()
            .Produces(StatusCodes.Status401Unauthorized)
            .AllowAnonymous();

        group.MapGet("/me", Me)
            .WithName("Me")
            .WithSummary("Retorna dados do usuário autenticado")
            .Produces<UserDto>()
            .Produces(StatusCodes.Status401Unauthorized)
            .RequireAuthorization();

        group.MapPost("/refresh", Refresh)
            .WithName("RefreshSession")
            .WithSummary("Re-emite o JWT com dados atualizados (orgs, role) sem precisar de senha")
            .Produces<AuthResponse>()
            .Produces(StatusCodes.Status401Unauthorized)
            .RequireAuthorization();
    }

    // ─── Handlers ────────────────────────────────────────────────────────────

    private static async Task<IResult> Register(
        [FromBody] RegisterRequest request,
        RegisterUseCase useCase,
        CancellationToken ct)
    {
        var response = await useCase.ExecuteAsync(request, ct);
        return Results.Created("/auth/me", response);
    }

    private static async Task<IResult> Login(
        [FromBody] LoginRequest request,
        LoginUseCase useCase,
        CancellationToken ct)
    {
        var response = await useCase.ExecuteAsync(request, ct);
        return Results.Ok(response);
    }

    private static async Task<IResult> GoogleAuth(
        [FromBody] GoogleAuthRequest request,
        GoogleAuthUseCase useCase,
        CancellationToken ct)
    {
        var response = await useCase.ExecuteAsync(request, ct);
        return Results.Ok(response);
    }

    private static async Task<IResult> Refresh(HttpContext ctx, RefreshSessionUseCase useCase, CancellationToken ct)
    {
        var sub = ctx.User.FindFirst(ClaimTypes.NameIdentifier)?.Value
               ?? ctx.User.FindFirst("sub")?.Value;

        if (!Guid.TryParse(sub, out var userId))
            return Results.Unauthorized();

        var response = await useCase.ExecuteAsync(userId, ct);
        return Results.Ok(response);
    }

    private static IResult Me(HttpContext ctx)
    {
        var claims = ctx.User;
        var id     = claims.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                  ?? claims.FindFirst("sub")?.Value;
        var email  = claims.FindFirst("email")?.Value
                  ?? claims.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value;
        var name   = claims.FindFirst("name")?.Value
                  ?? claims.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value;
        var role   = claims.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value ?? "Member";
        var orgId  = claims.FindFirst("org_id")?.Value;

        return Results.Ok(new
        {
            id    = Guid.TryParse(id, out var guid) ? guid : Guid.Empty,
            email = email ?? "",
            name  = name  ?? "",
            role,
            organizationId = Guid.TryParse(orgId, out var oid) ? oid : (Guid?)null,
        });
    }
}
