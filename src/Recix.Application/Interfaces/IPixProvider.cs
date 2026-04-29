namespace Recix.Application.Interfaces;

public sealed record PixChargeResult(
    string TxId,           // ID da transação no PSP (= ReferenceId sanitizado)
    string PixCopiaECola   // QR Code para o pagador escanear
);

/// <summary>
/// Abstração sobre o provedor PIX (EfiBank, Asaas, etc.).
/// FakePixProvider é usado em desenvolvimento quando nenhum PSP está configurado.
/// </summary>
public interface IPixProvider
{
    /// <summary>Cria uma cobrança PIX no PSP e retorna o QR Code.</summary>
    Task<PixChargeResult> CreateChargeAsync(
        string referenceId,
        decimal amount,
        DateTime expiresAt,
        CancellationToken ct = default);

    /// <summary>Registra a URL de webhook no PSP para receber notificações de pagamento.</summary>
    Task RegisterWebhookAsync(string webhookUrl, CancellationToken ct = default);
}
