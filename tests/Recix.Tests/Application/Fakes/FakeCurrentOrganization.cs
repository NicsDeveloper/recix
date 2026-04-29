using Recix.Application.Interfaces;

namespace Recix.Tests.Application.Fakes;

public sealed class FakeCurrentOrganization(Guid? orgId = null) : ICurrentOrganization
{
    public static readonly Guid DefaultOrgId = Guid.Parse("11111111-1111-1111-1111-111111111111");

    public Guid?  OrganizationId  { get; } = orgId ?? DefaultOrgId;
    public string Role            { get; } = "Owner";
    public bool   IsSystemContext  => OrganizationId is null;
}
