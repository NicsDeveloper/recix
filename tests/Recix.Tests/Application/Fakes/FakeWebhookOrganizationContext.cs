using Recix.Application.Interfaces;

namespace Recix.Tests.Application.Fakes;

/// <summary>Simula webhook PSP sem JWT (sem organização no contexto HTTP).</summary>
public sealed class FakeWebhookOrganizationContext : ICurrentOrganization
{
    public Guid? OrganizationId => null;
    public string Role            => "System";
    public bool   IsSystemContext => true;
}
