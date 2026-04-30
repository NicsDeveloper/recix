using Recix.Domain.Entities;

namespace Recix.Application.Interfaces;

public interface IOrgAlertConfigRepository
{
    Task<OrgAlertConfig?> GetByOrgIdAsync(Guid orgId, CancellationToken ct = default);
    Task UpsertAsync(OrgAlertConfig config, CancellationToken ct = default);
}
