namespace Recix.Application.DTOs;

// ─── Requests ─────────────────────────────────────────────────────────────────

public sealed class RegisterRequest
{
    public string  Email     { get; init; } = default!;
    public string  Name      { get; init; } = default!;
    public string  Password  { get; init; } = default!;

    // Opção A: criar nova organização
    public string? OrgName   { get; init; }

    // Opção B: solicitar acesso a uma organização existente
    public Guid?   JoinOrgId { get; init; }
    public string? Message   { get; init; }   // mensagem opcional para o admin
}

public sealed class LoginRequest
{
    public string Email    { get; init; } = default!;
    public string Password { get; init; } = default!;
}

public sealed class GoogleAuthRequest
{
    public string Credential { get; init; } = default!;
}

public sealed class SwitchOrgRequest
{
    public Guid OrganizationId { get; init; }
}

public sealed class InviteMemberRequest
{
    public string Email { get; init; } = default!;
    public string Role  { get; init; } = "Member";
}

public sealed class ReviewJoinRequestRequest
{
    public bool   Accept  { get; init; }
    public string? Reason { get; init; }
}

public sealed class JoinRequestDto
{
    public Guid     Id           { get; init; }
    public Guid     OrgId        { get; init; }
    public string   OrgName      { get; init; } = default!;
    public string   OrgSlug      { get; init; } = default!;
    public Guid     UserId       { get; init; }
    public string   UserName     { get; init; } = default!;
    public string   UserEmail    { get; init; } = default!;
    public string   Status       { get; init; } = default!;
    public string?  Message      { get; init; }
    public DateTime RequestedAt  { get; init; }
    public DateTime? ReviewedAt  { get; init; }
}

public sealed class OrgSearchDto
{
    public Guid   Id          { get; init; }
    public string Name        { get; init; } = default!;
    public string Slug        { get; init; } = default!;
    public int    MemberCount { get; init; }
}

// ─── Responses ────────────────────────────────────────────────────────────────

public sealed class AuthResponse
{
    public string  Token         { get; init; } = default!;
    public UserDto User          { get; init; } = default!;
    public List<OrgMembershipDto> Organizations { get; init; } = [];

    /// <summary>Preenchido quando o usuário ainda não tem org — aguardando aprovação.</summary>
    public JoinRequestDto? PendingJoinRequest { get; init; }
}

public sealed class UserDto
{
    public Guid   Id    { get; init; }
    public string Email { get; init; } = default!;
    public string Name  { get; init; } = default!;
    public string Role  { get; init; } = default!;   // role na org atual
}

public sealed class OrgMembershipDto
{
    public Guid   OrgId     { get; init; }
    public string Name      { get; init; } = default!;
    public string Slug      { get; init; } = default!;
    public string Role      { get; init; } = default!;
    public bool   IsCurrent { get; init; }
}

public sealed class OrganizationDto
{
    public Guid   Id        { get; init; }
    public string Name      { get; init; } = default!;
    public string Slug      { get; init; } = default!;
    public string Plan      { get; init; } = default!;
    public int    MemberCount { get; init; }
    public DateTime CreatedAt { get; init; }
}

public sealed class MemberDto
{
    public Guid   UserId   { get; init; }
    public string Name     { get; init; } = default!;
    public string Email    { get; init; } = default!;
    public string Role     { get; init; } = default!;
    public DateTime JoinedAt { get; init; }
}
