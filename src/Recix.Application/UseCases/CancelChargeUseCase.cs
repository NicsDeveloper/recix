using Recix.Application.Interfaces;

namespace Recix.Application.UseCases;

public sealed class CancelChargeUseCase(
    IChargeRepository charges,
    IEventBroadcaster broadcaster)
{
    public async Task ExecuteAsync(Guid chargeId, CancellationToken cancellationToken = default)
    {
        var charge = await charges.GetByIdAsync(chargeId, cancellationToken)
            ?? throw new KeyNotFoundException($"Charge {chargeId} not found.");

        charge.Cancel();
        await charges.UpdateAsync(charge, cancellationToken);
        broadcaster.Publish(RecixEvent.ChargeUpdated(charge.Id, charge.OrganizationId));
    }
}
