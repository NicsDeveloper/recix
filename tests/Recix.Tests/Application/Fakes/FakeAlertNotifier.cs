using Recix.Application.Interfaces;
using Recix.Domain.Enums;

namespace Recix.Tests.Application.Fakes;

public sealed class FakeAlertNotifier : IAlertNotifier
{
    public Task NotifyAsync(
        Guid orgId,
        ReconciliationStatus status,
        Guid? chargeId,
        Guid paymentEventId,
        decimal? expectedAmount,
        decimal paidAmount,
        string reason,
        CancellationToken ct = default) => Task.CompletedTask;
}
