namespace Recix.Application.Interfaces;

/// <summary>
/// Evento interno publicado quando algo muda na engine.
/// O frontend escuta via SSE e invalida as queries afetadas.
/// </summary>
public sealed record RecixEvent(string Type, string? EntityId = null)
{
    public static RecixEvent ChargeUpdated(Guid id)        => new("charge.updated",        id.ToString());
    public static RecixEvent PaymentEventUpdated(Guid id)  => new("payment_event.updated", id.ToString());
    public static RecixEvent ReconciliationCreated(Guid id)=> new("reconciliation.created",id.ToString());
    public static RecixEvent ChargesExpired(int count)     => new("charges.expired",        count.ToString());
}

/// <summary>
/// Canal in-process de broadcast. Registrado como Singleton.
/// Cada cliente SSE recebe uma "fila" dedicada via SubscribeAsync.
/// </summary>
public interface IEventBroadcaster
{
    void Publish(RecixEvent evt);
    IAsyncEnumerable<RecixEvent> SubscribeAsync(CancellationToken ct);
}
