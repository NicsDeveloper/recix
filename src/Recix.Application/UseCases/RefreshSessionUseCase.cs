using Recix.Application.DTOs;
using Recix.Application.Interfaces;

namespace Recix.Application.UseCases;

public sealed class RefreshSessionUseCase(
    IUserRepository users,
    LoginUseCase loginHelper)
{
    public async Task<AuthResponse> ExecuteAsync(Guid userId, CancellationToken ct = default)
    {
        var user = await users.GetByIdAsync(userId, ct)
            ?? throw new KeyNotFoundException("Usuário não encontrado.");

        return await loginHelper.BuildAuthResponseAsync(user, ct);
    }
}
