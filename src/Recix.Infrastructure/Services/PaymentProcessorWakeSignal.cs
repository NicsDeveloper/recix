using System.Threading.Channels;
using Recix.Application.Interfaces;

namespace Recix.Infrastructure.Services;

/// <summary>
/// Canal interno: cada chamada a <see cref="IPaymentProcessorWake.Pulse"/> desbloqueia o processador; múltiplos pulses são coalescidos.
/// </summary>
public sealed class PaymentProcessorWakeSignal : IPaymentProcessorWake
{
    private static readonly BoundedChannelOptions ChannelOptions = new(64)
    {
        FullMode           = BoundedChannelFullMode.DropOldest,
        SingleReader       = true,
        SingleWriter       = false,
        AllowSynchronousContinuations = false,
    };

    private readonly Channel<bool> _channel = Channel.CreateBounded<bool>(ChannelOptions);

    public void Pulse() => _channel.Writer.TryWrite(true);

    public async Task WaitForPulseOrTimeoutAsync(TimeSpan maxWait, CancellationToken cancellationToken = default)
    {
        using var linked = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        linked.CancelAfter(maxWait);

        try
        {
            await _channel.Reader.ReadAsync(linked.Token);
            while (_channel.Reader.TryRead(out _)) { }
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            // timeout — continua o loop para varrer a fila na mesma iteração
        }
    }
}
