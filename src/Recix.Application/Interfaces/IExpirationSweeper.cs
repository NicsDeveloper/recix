namespace Recix.Application.Interfaces;

/// <summary>
/// Executa a varredura de cobranças expiradas:
///   1. Marca cobranças Pending expiradas como Expired.
///   2. Gera ChargeWithoutPayment para cobranças Expired sem nenhuma conciliação.
/// Separado do BackgroundService para permitir invocação direta nos testes de integração.
/// </summary>
public interface IExpirationSweeper
{
    Task SweepAsync(CancellationToken ct = default);
}
