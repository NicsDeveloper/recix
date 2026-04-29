namespace Recix.Domain.Entities;

/// <summary>
/// Relacionamento N:N entre User e Organization.
/// O Role aqui define o papel do usuário NESTA organização.
/// </summary>
public sealed class OrganizationMember
{
    public Guid   OrganizationId { get; private set; }
    public Guid   UserId         { get; private set; }
    public string Role           { get; private set; } = OrgRoles.Member;
    public DateTime JoinedAt     { get; private set; }

    public Organization Organization { get; private set; } = null!;
    public User         User         { get; private set; } = null!;

    private OrganizationMember() { }

    public static OrganizationMember Create(Guid orgId, Guid userId, string role) => new()
    {
        OrganizationId = orgId,
        UserId         = userId,
        Role           = role,
        JoinedAt       = DateTime.UtcNow,
    };

    public void ChangeRole(string newRole) => Role = newRole;
}

public static class OrgRoles
{
    public const string Owner  = "Owner";
    public const string Admin  = "Admin";
    public const string Member = "Member";
    public const string Viewer = "Viewer";
}
