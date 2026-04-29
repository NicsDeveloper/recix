namespace Recix.Domain.Entities;

public sealed class User
{
    public Guid Id { get; private set; }
    public string Email { get; private set; } = default!;
    public string Name { get; private set; } = default!;
    public string? PasswordHash { get; private set; }
    public string? GoogleId { get; private set; }
    public string Role { get; private set; } = "Admin";
    public DateTime CreatedAt { get; private set; }
    public DateTime? LastLoginAt { get; private set; }

    // EF Core
    private User() { }

    public static User CreateWithPassword(string email, string name, string passwordHash) => new()
    {
        Id           = Guid.NewGuid(),
        Email        = email.Trim().ToLowerInvariant(),
        Name         = name.Trim(),
        PasswordHash = passwordHash,
        CreatedAt    = DateTime.UtcNow,
    };

    public static User CreateWithGoogle(string email, string name, string googleId) => new()
    {
        Id        = Guid.NewGuid(),
        Email     = email.Trim().ToLowerInvariant(),
        Name      = name.Trim(),
        GoogleId  = googleId,
        CreatedAt = DateTime.UtcNow,
    };

    public void RecordLogin()           => LastLoginAt = DateTime.UtcNow;
    public void LinkGoogle(string gid)  => GoogleId = gid;
    public void SetName(string name)    => Name = name.Trim();
}
