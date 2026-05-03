using Recix.Application.Interfaces;
using Recix.Domain.Enums;

namespace Recix.Application.Services;

/// <summary>Recalcula o status operacional da cobrança a partir das alocações reconhecidas persistidas.</summary>
public sealed class ChargeBalanceApplier(IChargeRepository charges, IReconciliationRepository reconciliations)
{
    public async Task RecalculateAsync(Guid chargeId, CancellationToken ct = default)
    {
        var charge = await charges.GetByIdAsync(chargeId, ct);
        if (charge is null || charge.Status == ChargeStatus.Cancelled)
            return;

        var sum = await reconciliations.SumAllocatedTowardChargeAsync(chargeId, ct);
        charge.SyncOperationalStatusFromRecognizedTotal(sum);
        await charges.UpdateAsync(charge, ct);
    }
}
