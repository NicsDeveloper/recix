using Recix.Application.DTOs;
using Recix.Application.Interfaces;
using Recix.Domain.Entities;
using Recix.Domain.Enums;

namespace Recix.Application.UseCases;

public sealed class ReviewJoinRequestUseCase(
    IOrganizationJoinRequestRepository joinRequests,
    IOrganizationRepository orgs,
    IUserRepository users,
    IEventBroadcaster broadcaster)
{
    public async Task<JoinRequestDto> ExecuteAsync(
        Guid requestId,
        Guid reviewerUserId,
        Guid reviewerOrgId,
        bool accept,
        CancellationToken ct = default)
    {
        var req = await joinRequests.GetByIdAsync(requestId, ct)
            ?? throw new KeyNotFoundException("Solicitação não encontrada.");

        if (req.OrganizationId != reviewerOrgId)
            throw new UnauthorizedAccessException("Você não tem permissão para revisar esta solicitação.");

        if (req.Status != JoinRequestStatus.Pending)
            throw new InvalidOperationException("Esta solicitação já foi processada.");

        if (accept)
        {
            req.Accept(reviewerUserId);
            // Adiciona o usuário como membro da organização
            var member = OrganizationMember.Create(req.OrganizationId, req.UserId, OrgRoles.Member);
            await orgs.AddMemberAsync(member, ct);
        }
        else
        {
            req.Reject(reviewerUserId);
        }

        await joinRequests.UpdateAsync(req, ct);
        broadcaster.Publish(RecixEvent.JoinRequestReviewed(req.Id, req.UserId, accept));

        // Busca dados para retorno
        var org  = await orgs.GetByIdAsync(req.OrganizationId, ct);
        var user = await users.GetByIdAsync(req.UserId, ct);

        return new JoinRequestDto
        {
            Id          = req.Id,
            OrgId       = req.OrganizationId,
            OrgName     = org?.Name ?? "",
            OrgSlug     = org?.Slug ?? "",
            UserId      = req.UserId,
            UserName    = user?.Name ?? "",
            UserEmail   = user?.Email ?? "",
            Status      = req.Status.ToString(),
            Message     = req.Message,
            RequestedAt = req.RequestedAt,
            ReviewedAt  = req.ReviewedAt,
        };
    }
}
