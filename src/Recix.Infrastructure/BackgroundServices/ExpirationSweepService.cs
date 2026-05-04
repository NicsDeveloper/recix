using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Recix.Application.Interfaces;

namespace Recix.Infrastructure.BackgroundServices;

/// <summary>
/// Shell de BackgroundService — delega a lógica real para <see cref="IExpirationSweeper"/>
/// (que pode ser invocado diretamente em testes de integração sem depender do loop).
/// </summary>
public sealed class ExpirationSweepService : BackgroundService
{
    private static readonly TimeSpan SweepInterval = TimeSpan.FromSeconds(30);

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<ExpirationSweepService> _logger;

    public ExpirationSweepService(
        IServiceScopeFactory scopeFactory,
        ILogger<ExpirationSweepService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger       = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("ExpirationSweepService started (interval={Interval}s).", SweepInterval.TotalSeconds);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await using var scope = _scopeFactory.CreateAsyncScope();
                var sweeper = scope.ServiceProvider.GetRequiredService<IExpirationSweeper>();
                await sweeper.SweepAsync(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogError(ex, "Unexpected error in ExpirationSweepService.");
            }

            await Task.Delay(SweepInterval, stoppingToken);
        }
    }
}
