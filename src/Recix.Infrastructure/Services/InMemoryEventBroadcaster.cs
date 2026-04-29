using System.Runtime.CompilerServices;
using System.Threading.Channels;
using Recix.Application.Interfaces;

namespace Recix.Infrastructure.Services;

/// <summary>
/// Broadcaster in-memory baseado em System.Threading.Channels.
/// Cada chamada de SubscribeAsync cria um canal dedicado para aquele cliente SSE.
/// Thread-safe via Lock (C# 13 / .NET 9).
/// </summary>
public sealed class InMemoryEventBroadcaster : IEventBroadcaster
{
    private readonly Lock _lock = new();
    private readonly List<Channel<RecixEvent>> _subscribers = [];

    public void Publish(RecixEvent evt)
    {
        lock (_lock)
        {
            foreach (var ch in _subscribers)
                ch.Writer.TryWrite(evt);
        }
    }

    public async IAsyncEnumerable<RecixEvent> SubscribeAsync(
        [EnumeratorCancellation] CancellationToken ct)
    {
        var channel = Channel.CreateUnbounded<RecixEvent>(
            new UnboundedChannelOptions { SingleReader = true });

        lock (_lock)
            _subscribers.Add(channel);

        try
        {
            await foreach (var evt in channel.Reader.ReadAllAsync(ct))
                yield return evt;
        }
        finally
        {
            lock (_lock)
                _subscribers.Remove(channel);

            channel.Writer.TryComplete();
        }
    }
}
