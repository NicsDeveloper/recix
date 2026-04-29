using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Recix.Application.Interfaces;

namespace Recix.Infrastructure.BackgroundServices;

/// <summary>
/// Varre cobranças Pending expiradas a cada 30 segundos e as marca como Expired.
/// Publica RecixEvent para notificar clientes SSE.
/// </summary>
public sealed class ExpirationSweepService : BackgroundService
{
    private static readonly TimeSpan SweepInterval = TimeSpan.FromSeconds(30);

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IEventBroadcaster _broadcaster;
    private readonly ILogger<ExpirationSweepService> _logger;

    public ExpirationSweepService(
        IServiceScopeFactory scopeFactory,
        IEventBroadcaster broadcaster,
        ILogger<ExpirationSweepService> logger)
    {
        _scopeFactory = scopeFactory;
        _broadcaster = broadcaster;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("ExpirationSweepService started (interval={Interval}s).", SweepInterval.TotalSeconds);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await SweepAsync(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogError(ex, "Unexpected error in ExpirationSweepService.");
            }

            await Task.Delay(SweepInterval, stoppingToken);
        }
    }

    private async Task SweepAsync(CancellationToken ct)
    {
        await using var scope = _scopeFactory.CreateAsyncScope();
        var charges = scope.ServiceProvider.GetRequiredService<IChargeRepository>();

        var expired = await charges.GetExpiredPendingAsync(ct);

        if (expired.Count == 0)
            return;

        _logger.LogInformation("ExpirationSweep: marking {Count} charge(s) as Expired.", expired.Count);

        foreach (var charge in expired)
        {
            charge.MarkAsExpired();
            await charges.UpdateAsync(charge, ct);
            _broadcaster.Publish(RecixEvent.ChargeUpdated(charge.Id));
        }

        _broadcaster.Publish(RecixEvent.ChargesExpired(expired.Count));

        _logger.LogInformation("ExpirationSweep: {Count} charge(s) marked as Expired.", expired.Count);
    }
}
