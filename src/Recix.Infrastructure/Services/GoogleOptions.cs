namespace Recix.Infrastructure.Services;

public sealed class GoogleOptions
{
    public const string SectionName = "Google";

    /// <summary>Client ID do OAuth 2.0 criado no Google Cloud Console.</summary>
    public string ClientId { get; set; } = string.Empty;
}
