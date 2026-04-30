namespace Recix.Application.Interfaces;

/// <summary>
/// Evento interno publicado quando algo muda na engine.
/// O frontend escuta via SSE e invalida as queries afetadas.
/// </summary>
public sealed record RecixEvent(string Type, string? EntityId = null, Guid? OrgId = null)
{
    public static RecixEvent ChargeUpdated(Guid id, Guid orgId)        => new("charge.updated",        id.ToString(), orgId);
    public static RecixEvent PaymentEventUpdated(Guid id, Guid orgId)  => new("payment_event.updated", id.ToString(), orgId);
    public static RecixEvent ReconciliationCreated(Guid id, Guid orgId)=> new("reconciliation.created",id.ToString(), orgId);
    public static RecixEvent ChargesExpired(int count, Guid orgId)     => new("charges.expired",       count.ToString(), orgId);
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
