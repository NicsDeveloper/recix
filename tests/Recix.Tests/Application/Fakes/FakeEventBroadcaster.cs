using Recix.Application.Interfaces;

namespace Recix.Tests.Application.Fakes;

public sealed class FakeEventBroadcaster : IEventBroadcaster
{
    public readonly List<RecixEvent> Published = [];

    public void Publish(RecixEvent evt) => Published.Add(evt);

#pragma warning disable CS1998
    public async IAsyncEnumerable<RecixEvent> SubscribeAsync(CancellationToken ct)
    {
        yield break;
    }
#pragma warning restore CS1998
}
