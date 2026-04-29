using Recix.Application.DTOs;
using Recix.Application.Interfaces;

namespace Recix.Application.UseCases;

/// <summary>Troca a organização ativa do usuário e emite um novo JWT.</summary>
public sealed class SwitchOrgUseCase(
    IUserRepository users,
    IOrganizationRepository orgs,
    IOrganizationJoinRequestRepository joinRequests,
    IJwtService jwt)
{
    public async Task<AuthResponse> ExecuteAsync(Guid userId, Guid targetOrgId, CancellationToken ct = default)
    {
        var membership = await orgs.GetMembershipAsync(targetOrgId, userId, ct)
            ?? throw new UnauthorizedAccessException("Você não é membro desta organização.");

        var user = await users.GetByIdAsync(userId, ct)
            ?? throw new UnauthorizedAccessException("Usuário não encontrado.");

        var loginHelper = new LoginUseCase(users, orgs, joinRequests, jwt, null!);
        return await loginHelper.BuildAuthResponseAsync(user, ct, targetOrgId);
    }
}
