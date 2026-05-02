using Recix.Application.DTOs;
using Recix.Application.Interfaces;
using Recix.Domain.Entities;

namespace Recix.Application.UseCases;

public sealed class GoogleAuthUseCase(
    IUserRepository users,
    IOrganizationRepository orgs,
    IOrganizationJoinRequestRepository joinRequests,
    IJwtService jwt,
    IGoogleTokenVerifier googleVerifier)
{
    public async Task<AuthResponse> ExecuteAsync(GoogleAuthRequest request, CancellationToken ct = default)
    {
        var payload = await googleVerifier.VerifyAsync(request.Credential, ct);

        var user = await users.GetByGoogleIdAsync(payload.Subject, ct)
                ?? await users.GetByEmailAsync(payload.Email, ct);

        if (user is null)
        {
            user = User.CreateWithGoogle(payload.Email, payload.Name, payload.Subject);
            await users.AddAsync(user, ct);
        }
        else
        {
            if (user.GoogleId is null) user.LinkGoogle(payload.Subject);
            user.SetName(payload.Name);
            user.RecordLogin();
            await users.UpdateAsync(user, ct);
        }

        // Sempre passa pelo BuildAuthResponseAsync — usuário novo sem org cai no fluxo de onboarding
        var loginHelper = new LoginUseCase(users, orgs, joinRequests, jwt, null!);
        return await loginHelper.BuildAuthResponseAsync(user, ct);
    }
}
