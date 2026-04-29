namespace Recix.Application.DTOs;

// ─── Requests ─────────────────────────────────────────────────────────────────

public sealed class RegisterRequest
{
    public string Email { get; init; } = default!;
    public string Name  { get; init; } = default!;
    public string Password { get; init; } = default!;
}

public sealed class LoginRequest
{
    public string Email    { get; init; } = default!;
    public string Password { get; init; } = default!;
}

public sealed class GoogleAuthRequest
{
    /// <summary>ID token retornado pelo Google Identity Services (credential).</summary>
    public string Credential { get; init; } = default!;
}

// ─── Responses ────────────────────────────────────────────────────────────────

public sealed class AuthResponse
{
    public string Token { get; init; } = default!;
    public UserDto User { get; init; } = default!;
}

public sealed class UserDto
{
    public Guid   Id    { get; init; }
    public string Email { get; init; } = default!;
    public string Name  { get; init; } = default!;
    public string Role  { get; init; } = default!;
}
