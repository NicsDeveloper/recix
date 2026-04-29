using Recix.Application.Interfaces;

namespace Recix.Infrastructure.Services;

/// <summary>
/// Provedor PIX fake para desenvolvimento local.
/// Ativado automaticamente quando EfiBank não está configurado.
/// Não gera QR Code real — apenas simula a criação da cobrança.
/// </summary>
public sealed class FakePixProvider : IPixProvider
{
    public Task<PixChargeResult> CreateChargeAsync(
        string referenceId,
        decimal amount,
        DateTime expiresAt,
        CancellationToken ct = default)
    {
        var txId = SanitizeTxId(referenceId);
        var fakePix = $"00020126580014BR.GOV.BCB.PIX0136{txId}5204000053039865802BR5913RECIX Engine6008Sao Paulo62070503***6304FAKE";

        return Task.FromResult(new PixChargeResult(txId, fakePix));
    }

    public Task RegisterWebhookAsync(string webhookUrl, CancellationToken ct = default)
        => Task.CompletedTask; // no-op em modo fake

    private static string SanitizeTxId(string referenceId) =>
        referenceId.Replace("-", "").Replace("_", "");
}
