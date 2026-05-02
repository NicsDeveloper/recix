using Recix.Application.Interfaces;

namespace Recix.Tests.Application.Fakes;

/// <summary>Use case tests: não há processador em background a desbloquear.</summary>
public sealed class NullPaymentProcessorWake : IPaymentProcessorWake
{
    public void Pulse() { }

    public Task WaitForPulseOrTimeoutAsync(TimeSpan maxWait, CancellationToken cancellationToken = default) =>
        Task.CompletedTask;
}
