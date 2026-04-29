using Microsoft.AspNetCore.Mvc;
using Recix.Application.DTOs;
using Recix.Application.UseCases;

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

    private static IResult Me(HttpContext ctx)
    {
        var user = ctx.User;
        var id    = user.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                 ?? user.FindFirst("sub")?.Value;
        var email = user.FindFirst("email")?.Value
                 ?? user.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value;
        var name  = user.FindFirst("name")?.Value
                 ?? user.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value;
        var role  = user.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value ?? "Admin";

        return Results.Ok(new UserDto
        {
            Id    = Guid.TryParse(id, out var guid) ? guid : Guid.Empty,
            Email = email ?? "",
            Name  = name  ?? "",
            Role  = role,
        });
    }
}
