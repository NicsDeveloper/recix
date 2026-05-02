using Microsoft.AspNetCore.SignalR;
using Recix.Api.Hubs;
using Recix.Application.Interfaces;

namespace Recix.Api.BackgroundServices;

/// <summary>
/// Faz a ponte entre o IEventBroadcaster (in-process, SSE) e o SignalR Hub,
/// reenviando cada evento ao grupo da organização correspondente.
/// Vive em Recix.Api para poder referenciar DashboardHub sem dependência circular.
/// </summary>
public sealed class SignalRBridgeService : BackgroundService
{
    private readonly IEventBroadcaster _broadcaster;
    private readonly IHubContext<DashboardHub> _hub;
    private readonly ILogger<SignalRBridgeService> _logger;

    public SignalRBridgeService(
        IEventBroadcaster broadcaster,
        IHubContext<DashboardHub> hub,
        ILogger<SignalRBridgeService> logger)
    {
        _broadcaster = broadcaster;
        _hub         = hub;
        _logger      = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("SignalRBridgeService iniciado — encaminhando eventos ao hub por grupo de org.");

        await foreach (var evt in _broadcaster.SubscribeAsync(stoppingToken))
        {
            if (evt.OrgId is null && evt.UserId is null) continue;

            try
            {
                var payload = new
                {
                    type     = evt.Type,
                    entityId = evt.EntityId,
                    orgId    = evt.OrgId?.ToString(),
                    userId   = evt.UserId?.ToString(),
                    accepted = evt.Accepted,
                };

                if (evt.OrgId is not null)
                {
                    await _hub.Clients
                        .Group(DashboardHub.OrgGroup(evt.OrgId.Value))
                        .SendAsync("RecixEvent", payload, stoppingToken);
                }

                if (evt.UserId is not null)
                {
                    await _hub.Clients
                        .Group(DashboardHub.UserGroup(evt.UserId.Value))
                        .SendAsync("RecixEvent", payload, stoppingToken);
                }
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogWarning(ex, "Erro ao encaminhar evento {Type} para SignalR.", evt.Type);
            }
        }
    }
}
