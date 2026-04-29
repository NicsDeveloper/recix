using Microsoft.EntityFrameworkCore;
using Recix.Application.Interfaces;
using Recix.Domain.Entities;
using Recix.Infrastructure.Persistence;
using System.Linq;

namespace Recix.Infrastructure.Repositories;

public sealed class OrganizationRepository(RecixDbContext db) : IOrganizationRepository
{
    public Task<Organization?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        db.Organizations.Include(o => o.Members).FirstOrDefaultAsync(o => o.Id == id, ct);

    public async Task<List<OrgSearchResult>> SearchAsync(string query, CancellationToken ct = default)
    {
        var q = query.Trim().ToLower();
        var orgs = await db.Organizations
            .Where(o => o.Name.ToLower().Contains(q) || o.Slug.Contains(q))
            .Take(10)
            .Select(o => new { o.Id, o.Name, o.Slug, MemberCount = o.Members.Count })
            .ToListAsync(ct);

        return orgs.Select(o => new OrgSearchResult(o.Id, o.Name, o.Slug, o.MemberCount)).ToList();
    }

    public Task<List<OrganizationMember>> GetMembershipsAsync(Guid userId, CancellationToken ct = default) =>
        db.OrganizationMembers
          .Include(m => m.Organization)
          .Where(m => m.UserId == userId)
          .OrderBy(m => m.JoinedAt)
          .ToListAsync(ct);

    public Task<OrganizationMember?> GetMembershipAsync(Guid orgId, Guid userId, CancellationToken ct = default) =>
        db.OrganizationMembers
          .Include(m => m.Organization)
          .FirstOrDefaultAsync(m => m.OrganizationId == orgId && m.UserId == userId, ct);

    public Task<bool> IsMemberAsync(Guid orgId, Guid userId, CancellationToken ct = default) =>
        db.OrganizationMembers.AnyAsync(m => m.OrganizationId == orgId && m.UserId == userId, ct);

    public async Task AddAsync(Organization org, CancellationToken ct = default)
    {
        db.Organizations.Add(org);
        await db.SaveChangesAsync(ct);
    }

    public async Task AddMemberAsync(OrganizationMember member, CancellationToken ct = default)
    {
        db.OrganizationMembers.Add(member);
        await db.SaveChangesAsync(ct);
    }

    public async Task UpdateMemberAsync(OrganizationMember member, CancellationToken ct = default)
    {
        db.OrganizationMembers.Update(member);
        await db.SaveChangesAsync(ct);
    }

    public async Task RemoveMemberAsync(OrganizationMember member, CancellationToken ct = default)
    {
        db.OrganizationMembers.Remove(member);
        await db.SaveChangesAsync(ct);
    }
}
