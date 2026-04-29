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

        bool isNew = user is null;

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

        // Se é um usuário novo pelo Google, cria automaticamente a primeira org
        if (isNew)
        {
            var orgName = payload.Name + "'s Organization";
            var org     = Organization.Create(orgName);
            var member  = OrganizationMember.Create(org.Id, user.Id, OrgRoles.Owner);
            await orgs.AddAsync(org, ct);
            await orgs.AddMemberAsync(member, ct);

            return new AuthResponse
            {
                Token = jwt.GenerateToken(user, org.Id, OrgRoles.Owner),
                User  = new UserDto { Id = user.Id, Email = user.Email, Name = user.Name, Role = OrgRoles.Owner },
                Organizations =
                [
                    new OrgMembershipDto { OrgId = org.Id, Name = org.Name, Slug = org.Slug, Role = OrgRoles.Owner, IsCurrent = true }
                ],
            };
        }

        // Usuário existente — reutiliza helper do LoginUseCase
        var loginHelper = new LoginUseCase(users, orgs, joinRequests, jwt, null!);
        return await loginHelper.BuildAuthResponseAsync(user, ct);
    }
}
