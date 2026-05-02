using Recix.Application.DTOs;
using Recix.Application.Interfaces;

namespace Recix.Application.UseCases;

public sealed class LoginUseCase(
    IUserRepository users,
    IOrganizationRepository orgs,
    IOrganizationJoinRequestRepository joinRequests,
    IJwtService jwt,
    IPasswordHasher hasher)
{
    public async Task<AuthResponse> ExecuteAsync(LoginRequest request, CancellationToken ct = default)
    {
        var user = await users.GetByEmailAsync(request.Email, ct)
            ?? throw new UnauthorizedAccessException("E-mail ou senha incorretos.");

        if (string.IsNullOrEmpty(user.PasswordHash))
            throw new UnauthorizedAccessException("Esta conta usa login com Google. Use o botão 'Entrar com Google'.");

        if (!hasher.Verify(request.Password, user.PasswordHash))
            throw new UnauthorizedAccessException("E-mail ou senha incorretos.");

        user.RecordLogin();
        await users.UpdateAsync(user, ct);

        return await BuildAuthResponseAsync(user, ct);
    }

    public async Task<AuthResponse> BuildAuthResponseAsync(
        Domain.Entities.User user,
        CancellationToken ct,
        Guid? preferredOrgId = null)
    {
        var memberships = await orgs.GetMembershipsAsync(user.Id, ct);

        // Sem org: verifica se tem solicitação pendente
        if (memberships.Count == 0)
        {
            var pending = await joinRequests.GetLatestByUserAsync(user.Id, ct);
            JoinRequestDto? pendingDto = null;

            if (pending is not null)
            {
                var pendingOrg = await orgs.GetByIdAsync(pending.OrganizationId, ct);
                if (pendingOrg is not null)
                    pendingDto = new JoinRequestDto
                    {
                        Id          = pending.Id,
                        OrgId       = pendingOrg.Id,
                        OrgName     = pendingOrg.Name,
                        OrgSlug     = pendingOrg.Slug,
                        UserId      = user.Id,
                        UserName    = user.Name,
                        UserEmail   = user.Email,
                        Status      = pending.Status.ToString(),
                        Message     = pending.Message,
                        RequestedAt = pending.RequestedAt,
                        ReviewedAt  = pending.ReviewedAt,
                    };
            }

            return new AuthResponse
            {
                Token              = jwt.GenerateToken(user, null, null),
                User               = new UserDto { Id = user.Id, Email = user.Email, Name = user.Name, Role = "Pending" },
                Organizations      = [],
                PendingJoinRequest = pendingDto,
            };
        }

        // Com org: fluxo normal
        var current = (preferredOrgId.HasValue
            ? memberships.FirstOrDefault(m => m.OrganizationId == preferredOrgId)
            : null) ?? memberships[0];

        return new AuthResponse
        {
            Token = jwt.GenerateToken(user, current.OrganizationId, current.Role),
            User  = new UserDto { Id = user.Id, Email = user.Email, Name = user.Name, Role = current.Role },
            Organizations = memberships.Select(m => new OrgMembershipDto
            {
                OrgId     = m.OrganizationId,
                Name      = m.Organization.Name,
                Slug      = m.Organization.Slug,
                Role      = m.Role,
                IsCurrent = m.OrganizationId == current.OrganizationId,
            }).ToList(),
        };
    }
}
