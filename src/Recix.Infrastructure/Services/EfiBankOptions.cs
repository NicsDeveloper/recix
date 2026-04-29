namespace Recix.Infrastructure.Services;

public sealed class EfiBankOptions
{
    public const string SectionName = "EfiBank";

    public string ClientId { get; set; } = string.Empty;
    public string ClientSecret { get; set; } = string.Empty;

    /// <summary>Caminho para o arquivo .p12 do certificado mTLS.</summary>
    public string CertificatePath { get; set; } = string.Empty;

    /// <summary>Senha do arquivo .p12.</summary>
    public string CertificatePassword { get; set; } = string.Empty;

    /// <summary>Chave PIX cadastrada na conta (CPF, CNPJ, email ou chave aleatória).</summary>
    public string PixKey { get; set; } = string.Empty;

    /// <summary>URL pública do webhook (ex: https://abc.ngrok-free.app).</summary>
    public string WebhookBaseUrl { get; set; } = string.Empty;

    /// <summary>Usa sandbox da EfiBank quando true (default).</summary>
    public bool IsSandbox { get; set; } = true;

    /// <summary>Valida certificado mTLS nos webhooks recebidos. Desabilite no sandbox para testes iniciais.</summary>
    public bool ValidateWebhookMtls { get; set; } = false;

    public string ApiBaseUrl => IsSandbox
        ? "https://pix-h.api.efipay.com.br"
        : "https://pix.api.efipay.com.br";

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(ClientId) &&
        !string.IsNullOrWhiteSpace(ClientSecret) &&
        !string.IsNullOrWhiteSpace(CertificatePath) &&
        !string.IsNullOrWhiteSpace(PixKey);
}
