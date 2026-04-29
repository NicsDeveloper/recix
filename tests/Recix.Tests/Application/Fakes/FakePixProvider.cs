using Recix.Application.Interfaces;

namespace Recix.Tests.Application.Fakes;

public sealed class FakePixProvider : IPixProvider
{
    public Task<PixChargeResult> CreateChargeAsync(string referenceId, decimal amount, DateTime expiresAt, CancellationToken ct = default)
    {
        var txId = $"fakepsp_{referenceId.Replace("-", "")}";
        var result = new PixChargeResult(txId, $"00020126330014BR.GOV.BCB.PIX0111fake-{referenceId}");
        return Task.FromResult(result);
    }

    public Task RegisterWebhookAsync(string webhookUrl, CancellationToken ct = default) =>
        Task.CompletedTask;
}
