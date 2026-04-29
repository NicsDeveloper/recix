using Recix.Domain.Entities;

namespace Recix.Application.Interfaces;

public interface IJwtService
{
    /// <summary>
    /// Gera um JWT.
    /// organizationId == null → token sem contexto de org (ex: usuário aguardando aprovação).
    /// </summary>
    string GenerateToken(User user, Guid? organizationId, string? orgRole);
}
