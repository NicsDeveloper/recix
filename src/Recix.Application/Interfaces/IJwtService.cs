using Recix.Domain.Entities;

namespace Recix.Application.Interfaces;

public interface IJwtService
{
    string GenerateToken(User user);
}
