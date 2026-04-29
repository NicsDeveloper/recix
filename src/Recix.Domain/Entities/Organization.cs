namespace Recix.Domain.Entities;

public sealed class Organization
{
    public Guid   Id        { get; private set; }
    public string Name      { get; private set; } = default!;
    public string Slug      { get; private set; } = default!;   // ex: "empresa-xyz"
    public string Plan      { get; private set; } = "Free";
    public DateTime CreatedAt { get; private set; }

    public ICollection<OrganizationMember> Members { get; private set; } = [];

    private Organization() { }

    public static Organization Create(string name) => new()
    {
        Id        = Guid.NewGuid(),
        Name      = name.Trim(),
        Slug      = GenerateSlug(name),
        CreatedAt = DateTime.UtcNow,
    };

    public void Rename(string name)
    {
        Name = name.Trim();
        Slug = GenerateSlug(name);
    }

    private static string GenerateSlug(string name) =>
        System.Text.RegularExpressions.Regex
            .Replace(name.Trim().ToLowerInvariant(), @"[^a-z0-9]+", "-")
            .Trim('-');
}
