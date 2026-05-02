namespace Recix.Application.Interfaces;

/// <summary>
/// Sinaliza o serviço em background que processa eventos de pagamento sem esperar o intervalo
/// de polling — latência mínima após ingestão de webhook.
/// </summary>
public interface IPaymentProcessorWake
{
    /// <summary>Notifica que há (ou pode haver) eventos de pagamento recebidos a processar.</summary>
    void Pulse();

    /// <summary>Aguarda um <see cref="Pulse"/> ou até <paramref name="maxWait"/> (o que ocorrer primeiro).</summary>
    Task WaitForPulseOrTimeoutAsync(TimeSpan maxWait, CancellationToken cancellationToken = default);
}
