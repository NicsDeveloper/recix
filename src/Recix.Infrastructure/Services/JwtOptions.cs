namespace Recix.Infrastructure.Services;

public sealed class JwtOptions
{
    public const string SectionName = "Jwt";

    /// <summary>Chave secreta HS256 — mínimo 32 caracteres.</summary>
    public string Secret { get; set; } = "recix-dev-secret-change-in-production-!!!";
    public string Issuer   { get; set; } = "recix-api";
    public string Audience { get; set; } = "recix-frontend";

    /// <summary>Duração do token em minutos. Default: 1 dia.</summary>
    public int ExpiresInMinutes { get; set; } = 1440;
}
