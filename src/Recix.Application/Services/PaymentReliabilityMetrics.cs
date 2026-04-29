using System.Threading;

namespace Recix.Application.Services;

public sealed class PaymentReliabilityMetrics
{
    private long _received;
    private long _processed;
    private long _failed;
    private long _duplicates;
    private long _stuckRecovered;

    public void IncrementReceived() => Interlocked.Increment(ref _received);
    public void IncrementProcessed() => Interlocked.Increment(ref _processed);
    public void IncrementFailed() => Interlocked.Increment(ref _failed);
    public void IncrementDuplicates() => Interlocked.Increment(ref _duplicates);
    public void IncrementStuckRecovered(int count) => Interlocked.Add(ref _stuckRecovered, count);

    public object Snapshot() => new
    {
        received = Interlocked.Read(ref _received),
        processed = Interlocked.Read(ref _processed),
        failed = Interlocked.Read(ref _failed),
        duplicates = Interlocked.Read(ref _duplicates),
        stuckRecovered = Interlocked.Read(ref _stuckRecovered),
    };
}
