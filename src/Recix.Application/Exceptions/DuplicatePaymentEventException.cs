namespace Recix.Application.Exceptions;

public sealed class DuplicatePaymentEventException : Exception
{
    public DuplicatePaymentEventException(string eventId, Exception? innerException = null)
        : base($"Payment event with EventId '{eventId}' already exists.", innerException)
    {
        EventId = eventId;
    }

    public string EventId { get; }
}
