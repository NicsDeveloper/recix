using Recix.Domain.Entities;
using Recix.Domain.Enums;

namespace Recix.Application.Interfaces;

public interface IOrganizationJoinRequestRepository
{
    Task<OrganizationJoinRequest?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<OrganizationJoinRequest?> GetPendingByUserAndOrgAsync(Guid userId, Guid orgId, CancellationToken ct = default);
    Task<OrganizationJoinRequest?> GetLatestByUserAsync(Guid userId, CancellationToken ct = default);
    Task<List<OrganizationJoinRequest>> ListPendingByOrgAsync(Guid orgId, CancellationToken ct = default);
    Task<int> CountPendingByOrgAsync(Guid orgId, CancellationToken ct = default);
    Task AddAsync(OrganizationJoinRequest request, CancellationToken ct = default);
    Task UpdateAsync(OrganizationJoinRequest request, CancellationToken ct = default);
}
