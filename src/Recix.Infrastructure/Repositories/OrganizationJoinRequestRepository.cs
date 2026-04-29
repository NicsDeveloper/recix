using Microsoft.EntityFrameworkCore;
using Recix.Application.Interfaces;
using Recix.Domain.Entities;
using Recix.Domain.Enums;
using Recix.Infrastructure.Persistence;

namespace Recix.Infrastructure.Repositories;

public sealed class OrganizationJoinRequestRepository(RecixDbContext db) : IOrganizationJoinRequestRepository
{
    public Task<OrganizationJoinRequest?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        db.OrganizationJoinRequests
          .Include(r => r.Organization)
          .Include(r => r.User)
          .FirstOrDefaultAsync(r => r.Id == id, ct);

    public Task<OrganizationJoinRequest?> GetPendingByUserAndOrgAsync(Guid userId, Guid orgId, CancellationToken ct = default) =>
        db.OrganizationJoinRequests
          .FirstOrDefaultAsync(r => r.UserId == userId && r.OrganizationId == orgId
                                 && r.Status == JoinRequestStatus.Pending, ct);

    public Task<OrganizationJoinRequest?> GetLatestByUserAsync(Guid userId, CancellationToken ct = default) =>
        db.OrganizationJoinRequests
          .Include(r => r.Organization)
          .Where(r => r.UserId == userId)
          .OrderByDescending(r => r.RequestedAt)
          .FirstOrDefaultAsync(ct);

    public Task<List<OrganizationJoinRequest>> ListPendingByOrgAsync(Guid orgId, CancellationToken ct = default) =>
        db.OrganizationJoinRequests
          .Include(r => r.User)
          .Where(r => r.OrganizationId == orgId && r.Status == JoinRequestStatus.Pending)
          .OrderBy(r => r.RequestedAt)
          .ToListAsync(ct);

    public Task<int> CountPendingByOrgAsync(Guid orgId, CancellationToken ct = default) =>
        db.OrganizationJoinRequests
          .CountAsync(r => r.OrganizationId == orgId && r.Status == JoinRequestStatus.Pending, ct);

    public async Task AddAsync(OrganizationJoinRequest request, CancellationToken ct = default)
    {
        db.OrganizationJoinRequests.Add(request);
        await db.SaveChangesAsync(ct);
    }

    public async Task UpdateAsync(OrganizationJoinRequest request, CancellationToken ct = default)
    {
        db.OrganizationJoinRequests.Update(request);
        await db.SaveChangesAsync(ct);
    }
}
