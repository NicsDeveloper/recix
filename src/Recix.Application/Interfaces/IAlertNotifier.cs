using Recix.Domain.Enums;

namespace Recix.Application.Interfaces;

public interface IAlertNotifier
{
    /// <summary>
    /// Dispara uma notificação assíncrona para a org quando uma divergência é detectada.
    /// Nunca lança exceção — falhas são logadas silenciosamente.
    /// </summary>
    Task NotifyAsync(
        Guid orgId,
        ReconciliationStatus status,
        Guid? chargeId,
        Guid paymentEventId,
        decimal? expectedAmount,
        decimal paidAmount,
        string reason,
        CancellationToken ct = default);
}
