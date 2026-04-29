using Recix.Application.DTOs;
using Recix.Application.Interfaces;
using Recix.Domain.Entities;

namespace Recix.Application.UseCases;

public sealed class RegisterUseCase(
    IUserRepository users,
    IOrganizationRepository orgs,
    IOrganizationJoinRequestRepository joinRequests,
    IJwtService jwt,
    IPasswordHasher hasher)
{
    public async Task<AuthResponse> ExecuteAsync(RegisterRequest request, CancellationToken ct = default)
    {
        // ── Validações básicas ─────────────────────────────────────────────────
        if (string.IsNullOrWhiteSpace(request.Email))
            throw new ArgumentException("E-mail é obrigatório.");
        if (string.IsNullOrWhiteSpace(request.Password) || request.Password.Length < 6)
            throw new ArgumentException("Senha deve ter pelo menos 6 caracteres.");
        if (string.IsNullOrWhiteSpace(request.Name))
            throw new ArgumentException("Nome é obrigatório.");

        bool creatingOrg  = !string.IsNullOrWhiteSpace(request.OrgName);
        bool requestingOrg = request.JoinOrgId.HasValue;

        if (!creatingOrg && !requestingOrg)
            throw new ArgumentException("Informe o nome da empresa ou selecione uma para solicitar acesso.");

        if (await users.ExistsAsync(request.Email, ct))
            throw new InvalidOperationException("Já existe uma conta com este e-mail.");

        // ── Cria usuário ───────────────────────────────────────────────────────
        var user = User.CreateWithPassword(request.Email, request.Name, hasher.Hash(request.Password));
        await users.AddAsync(user, ct);

        // ── Opção A: criar nova organização ───────────────────────────────────
        if (creatingOrg)
        {
            var org    = Organization.Create(request.OrgName!);
            var member = OrganizationMember.Create(org.Id, user.Id, OrgRoles.Owner);
            await orgs.AddAsync(org, ct);
            await orgs.AddMemberAsync(member, ct);

            return new AuthResponse
            {
                Token         = jwt.GenerateToken(user, org.Id, OrgRoles.Owner),
                User          = ToUserDto(user, OrgRoles.Owner),
                Organizations = [new OrgMembershipDto
                {
                    OrgId = org.Id, Name = org.Name, Slug = org.Slug,
                    Role  = OrgRoles.Owner, IsCurrent = true,
                }],
            };
        }

        // ── Opção B: solicitar acesso a organização existente ─────────────────
        var targetOrg = await orgs.GetByIdAsync(request.JoinOrgId!.Value, ct)
            ?? throw new ArgumentException("Organização não encontrada.");

        // Verifica se já existe solicitação pendente
        var existing = await joinRequests.GetPendingByUserAndOrgAsync(user.Id, targetOrg.Id, ct);
        if (existing is not null)
            throw new InvalidOperationException("Já existe uma solicitação pendente para esta organização.");

        var joinReq = OrganizationJoinRequest.Create(targetOrg.Id, user.Id, request.Message);
        await joinRequests.AddAsync(joinReq, ct);

        // JWT sem org_id — o usuário não tem acesso até ser aprovado
        return new AuthResponse
        {
            Token              = jwt.GenerateToken(user, null, null),
            User               = ToUserDto(user, null),
            Organizations      = [],
            PendingJoinRequest = ToJoinRequestDto(joinReq, targetOrg, user),
        };
    }

    private static UserDto ToUserDto(User user, string? role) => new()
    {
        Id    = user.Id,
        Email = user.Email,
        Name  = user.Name,
        Role  = role ?? "Pending",
    };

    private static JoinRequestDto ToJoinRequestDto(
        OrganizationJoinRequest req, Organization org, User user) => new()
    {
        Id          = req.Id,
        OrgId       = org.Id,
        OrgName     = org.Name,
        OrgSlug     = org.Slug,
        UserId      = user.Id,
        UserName    = user.Name,
        UserEmail   = user.Email,
        Status      = req.Status.ToString(),
        Message     = req.Message,
        RequestedAt = req.RequestedAt,
        ReviewedAt  = req.ReviewedAt,
    };
}
