using Microsoft.Extensions.Logging;
using Recix.Application.Interfaces;
using Recix.Domain.Entities;

namespace Recix.Infrastructure.BackgroundServices;

/// <summary>
/// Implementação de <see cref="IExpirationSweeper"/>.
/// Recebe repositórios diretamente — o escopo de DI é gerenciado pelo chamador
/// (BackgroundService ou teste de integração).
/// </summary>
public sealed class ExpirationSweeper(
    IChargeRepository charges,
    IReconciliationRepository reconciliations,
    IEventBroadcaster broadcaster,
    ILogger<ExpirationSweeper> logger) : IExpirationSweeper
{
    public async Task SweepAsync(CancellationToken ct = default)
    {
        // ── Passo 1: marcar cobranças Pending expiradas ───────────────────────────
        var expired = await charges.GetExpiredPendingAsync(ct);

        if (expired.Count > 0)
        {
            logger.LogInformation("ExpirationSweep: marking {Count} charge(s) as Expired.", expired.Count);

            foreach (var charge in expired)
            {
                charge.MarkAsExpired();
                await charges.UpdateAsync(charge, ct);
                broadcaster.Publish(RecixEvent.ChargeUpdated(charge.Id, charge.OrganizationId));
            }

            foreach (var grp in expired.GroupBy(c => c.OrganizationId))
                broadcaster.Publish(RecixEvent.ChargesExpired(grp.Count(), grp.Key));
        }

        // ── Passo 2: gerar ChargeWithoutPayment para Expired sem reconciliação ────
        var withoutPayment = await charges.GetExpiredWithoutReconciliationAsync(ct);

        if (withoutPayment.Count == 0)
            return;

        logger.LogInformation(
            "ExpirationSweep: generating ChargeWithoutPayment for {Count} charge(s).",
            withoutPayment.Count);

        foreach (var charge in withoutPayment)
        {
            var result = ReconciliationResult.CreateChargeWithoutPayment(
                charge.OrganizationId, charge.Id, charge.Amount);

            await reconciliations.AddAsync(result, ct);
            broadcaster.Publish(RecixEvent.ReconciliationCreated(result.Id, charge.OrganizationId));
        }
    }
}
