namespace Recix.Application.Interfaces;

/// <summary>
/// Fornece o contexto de organização do request atual.
/// OrganizationId == null → contexto de sistema (background services) — sem filtragem por org.
/// </summary>
public interface ICurrentOrganization
{
    Guid?  OrganizationId   { get; }
    string Role             { get; }
    bool   IsSystemContext  { get; }
}
