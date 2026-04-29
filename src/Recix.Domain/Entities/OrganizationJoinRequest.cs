using Recix.Domain.Enums;

namespace Recix.Domain.Entities;

public sealed class OrganizationJoinRequest
{
    public Guid               Id               { get; private set; }
    public Guid               OrganizationId   { get; private set; }
    public Guid               UserId           { get; private set; }
    public JoinRequestStatus  Status           { get; private set; }
    public string?            Message          { get; private set; }
    public DateTime           RequestedAt      { get; private set; }
    public DateTime?          ReviewedAt       { get; private set; }
    public Guid?              ReviewedByUserId { get; private set; }

    public Organization Organization { get; private set; } = null!;
    public User         User         { get; private set; } = null!;

    private OrganizationJoinRequest() { }

    public static OrganizationJoinRequest Create(Guid orgId, Guid userId, string? message = null) => new()
    {
        Id             = Guid.NewGuid(),
        OrganizationId = orgId,
        UserId         = userId,
        Status         = JoinRequestStatus.Pending,
        Message        = message?.Trim(),
        RequestedAt    = DateTime.UtcNow,
    };

    public void Accept(Guid reviewedBy)
    {
        Status           = JoinRequestStatus.Accepted;
        ReviewedAt       = DateTime.UtcNow;
        ReviewedByUserId = reviewedBy;
    }

    public void Reject(Guid reviewedBy)
    {
        Status           = JoinRequestStatus.Rejected;
        ReviewedAt       = DateTime.UtcNow;
        ReviewedByUserId = reviewedBy;
    }
}
