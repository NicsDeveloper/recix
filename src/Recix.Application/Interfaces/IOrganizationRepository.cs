using Recix.Domain.Entities;

namespace Recix.Application.Interfaces;

public sealed record OrgSearchResult(Guid Id, string Name, string Slug, int MemberCount);

public interface IOrganizationRepository
{
    Task<Organization?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<List<OrgSearchResult>> SearchAsync(string query, CancellationToken ct = default);
    Task<List<OrganizationMember>> GetMembershipsAsync(Guid userId, CancellationToken ct = default);
    Task<List<OrganizationMember>> GetMembersByOrgAsync(Guid orgId, CancellationToken ct = default);
    Task<OrganizationMember?> GetMembershipAsync(Guid orgId, Guid userId, CancellationToken ct = default);
    Task<bool> IsMemberAsync(Guid orgId, Guid userId, CancellationToken ct = default);
    Task AddAsync(Organization org, CancellationToken ct = default);
    Task AddMemberAsync(OrganizationMember member, CancellationToken ct = default);
    Task UpdateMemberAsync(OrganizationMember member, CancellationToken ct = default);
    Task RemoveMemberAsync(OrganizationMember member, CancellationToken ct = default);
}
