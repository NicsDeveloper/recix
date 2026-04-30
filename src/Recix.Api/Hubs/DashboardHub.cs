using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace Recix.Api.Hubs;

/// <summary>
/// Hub SignalR para push de eventos da dashboard em tempo real.
/// Ao conectar, o cliente entra automaticamente no grupo da sua organização.
/// Clientes de orgs diferentes nunca recebem eventos uns dos outros.
/// </summary>
[Authorize]
public sealed class DashboardHub : Hub
{
    public override async Task OnConnectedAsync()
    {
        var orgId = Context.User?.FindFirst("org_id")?.Value;
        if (!string.IsNullOrEmpty(orgId))
            await Groups.AddToGroupAsync(Context.ConnectionId, OrgGroup(orgId));

        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var orgId = Context.User?.FindFirst("org_id")?.Value;
        if (!string.IsNullOrEmpty(orgId))
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, OrgGroup(orgId));

        await base.OnDisconnectedAsync(exception);
    }

    /// <summary>Nome do grupo SignalR para uma organização.</summary>
    public static string OrgGroup(string orgId) => $"org:{orgId}";
    public static string OrgGroup(Guid orgId)   => OrgGroup(orgId.ToString());
}
