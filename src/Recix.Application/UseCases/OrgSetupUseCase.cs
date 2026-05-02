using Recix.Application.DTOs;
using Recix.Application.Interfaces;
using Recix.Domain.Entities;

namespace Recix.Application.UseCases;

/// <summary>
/// Permite que um usuário autenticado sem organização crie uma nova empresa
/// ou solicite entrada em uma existente. Retorna um novo AuthResponse com JWT atualizado.
/// </summary>
public sealed class OrgSetupUseCase(
    IUserRepository users,
    IOrganizationRepository orgs,
    IOrganizationJoinRequestRepository joinRequests,
    IJwtService jwt,
    LoginUseCase loginHelper)
{
    public async Task<AuthResponse> CreateOrgAsync(Guid userId, string orgName, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(orgName))
            throw new ArgumentException("Nome da empresa é obrigatório.");

        var user = await users.GetByIdAsync(userId, ct)
            ?? throw new KeyNotFoundException("Usuário não encontrado.");

        var memberships = await orgs.GetMembershipsAsync(userId, ct);
        if (memberships.Count > 0)
            throw new InvalidOperationException("Usuário já pertence a uma organização.");

        var org    = Organization.Create(orgName.Trim());
        var member = OrganizationMember.Create(org.Id, user.Id, OrgRoles.Owner);
        await orgs.AddAsync(org, ct);
        await orgs.AddMemberAsync(member, ct);

        return new AuthResponse
        {
            Token = jwt.GenerateToken(user, org.Id, OrgRoles.Owner),
            User  = new UserDto { Id = user.Id, Email = user.Email, Name = user.Name, Role = OrgRoles.Owner },
            Organizations =
            [
                new OrgMembershipDto { OrgId = org.Id, Name = org.Name, Slug = org.Slug, Role = OrgRoles.Owner, IsCurrent = true },
            ],
        };
    }

    public async Task<AuthResponse> RequestJoinAsync(Guid userId, Guid orgId, string? message, CancellationToken ct = default)
    {
        var user = await users.GetByIdAsync(userId, ct)
            ?? throw new KeyNotFoundException("Usuário não encontrado.");

        var memberships = await orgs.GetMembershipsAsync(userId, ct);
        if (memberships.Count > 0)
            throw new InvalidOperationException("Usuário já pertence a uma organização.");

        var targetOrg = await orgs.GetByIdAsync(orgId, ct)
            ?? throw new ArgumentException("Organização não encontrada.");

        var existing = await joinRequests.GetPendingByUserAndOrgAsync(userId, orgId, ct);
        if (existing is not null)
            throw new InvalidOperationException("Já existe uma solicitação pendente para esta organização.");

        var joinReq = OrganizationJoinRequest.Create(orgId, userId, message);
        await joinRequests.AddAsync(joinReq, ct);

        return new AuthResponse
        {
            Token = jwt.GenerateToken(user, null, null),
            User  = new UserDto { Id = user.Id, Email = user.Email, Name = user.Name, Role = "Pending" },
            Organizations = [],
            PendingJoinRequest = new JoinRequestDto
            {
                Id          = joinReq.Id,
                OrgId       = targetOrg.Id,
                OrgName     = targetOrg.Name,
                OrgSlug     = targetOrg.Slug,
                UserId      = user.Id,
                UserName    = user.Name,
                UserEmail   = user.Email,
                Status      = joinReq.Status.ToString(),
                Message     = joinReq.Message,
                RequestedAt = joinReq.RequestedAt,
                ReviewedAt  = joinReq.ReviewedAt,
            },
        };
    }
}
