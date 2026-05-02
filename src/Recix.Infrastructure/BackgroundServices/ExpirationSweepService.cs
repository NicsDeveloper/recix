using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Recix.Application.Interfaces;
using Recix.Domain.Entities;

namespace Recix.Infrastructure.BackgroundServices;

/// <summary>
/// Varre cobranças Pending expiradas a cada 30 segundos e as marca como Expired.
/// Também gera ReconciliationResult com status ChargeWithoutPayment para cobranças
/// Expired que nunca receberam pagamento, tornando-as visíveis na tela de conciliação.
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
        _broadcaster  = broadcaster;
        _logger       = logger;
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
        await using var scope          = _scopeFactory.CreateAsyncScope();
        var charges                    = scope.ServiceProvider.GetRequiredService<IChargeRepository>();
        var reconciliations            = scope.ServiceProvider.GetRequiredService<IReconciliationRepository>();

        // ── Passo 1: marcar cobranças Pending expiradas ───────────────────────────
        var expired = await charges.GetExpiredPendingAsync(ct);

        if (expired.Count > 0)
        {
            _logger.LogInformation("ExpirationSweep: marking {Count} charge(s) as Expired.", expired.Count);

            foreach (var charge in expired)
            {
                charge.MarkAsExpired();
                await charges.UpdateAsync(charge, ct);
                _broadcaster.Publish(RecixEvent.ChargeUpdated(charge.Id, charge.OrganizationId));
            }

            foreach (var grp in expired.GroupBy(c => c.OrganizationId))
                _broadcaster.Publish(RecixEvent.ChargesExpired(grp.Count(), grp.Key));
        }

        // ── Passo 2: gerar ChargeWithoutPayment para Expired sem reconciliação ────
        // Cobranças expiradas sem nenhum ReconciliationResult associado são "invisíveis"
        // na tela de conciliação. Criamos um resultado sentinela para torná-las visíveis
        // e computá-las corretamente nos KPIs de "venda não recebida".
        var withoutPayment = await charges.GetExpiredWithoutReconciliationAsync(ct);

        if (withoutPayment.Count == 0)
            return;

        _logger.LogInformation(
            "ExpirationSweep: generating ChargeWithoutPayment for {Count} charge(s).",
            withoutPayment.Count);

        foreach (var charge in withoutPayment)
        {
            var result = ReconciliationResult.CreateChargeWithoutPayment(
                charge.OrganizationId, charge.Id, charge.Amount);

            await reconciliations.AddAsync(result, ct);
            _broadcaster.Publish(RecixEvent.ReconciliationCreated(result.Id, charge.OrganizationId));
        }
    }
}
