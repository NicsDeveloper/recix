using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Recix.Application.Interfaces;

namespace Recix.Infrastructure.Services;

/// <summary>
/// Lê o contexto de organização a partir dos claims do JWT no request HTTP corrente.
/// </summary>
public sealed class HttpCurrentOrganization(IHttpContextAccessor httpContextAccessor) : ICurrentOrganization
{
    public Guid? OrganizationId
    {
        get
        {
            var claim = httpContextAccessor.HttpContext?.User?.FindFirst("org_id")?.Value;
            return Guid.TryParse(claim, out var id) ? id : null;
        }
    }

    public string Role =>
        httpContextAccessor.HttpContext?.User?.FindFirst(ClaimTypes.Role)?.Value ?? "Viewer";

    public bool IsSystemContext => false;
}

/// <summary>
/// Contexto de sistema — usado pelos BackgroundServices.
/// OrganizationId == null → sem filtro de org (acessa todos os tenants).
/// </summary>
public sealed class SystemOrgContext : ICurrentOrganization
{
    public Guid?  OrganizationId  => null;
    public string Role            => "System";
    public bool   IsSystemContext => true;
}
