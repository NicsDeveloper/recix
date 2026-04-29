using Google.Apis.Auth;
using Recix.Application.Interfaces;

namespace Recix.Infrastructure.Services;

public sealed class GoogleTokenVerifier : IGoogleTokenVerifier
{
    private readonly GoogleOptions _options;

    public GoogleTokenVerifier(GoogleOptions options) => _options = options;

    public async Task<GooglePayload> VerifyAsync(string credential, CancellationToken ct = default)
    {
        var settings = new GoogleJsonWebSignature.ValidationSettings();

        if (!string.IsNullOrWhiteSpace(_options.ClientId))
            settings.Audience = new[] { _options.ClientId };

        GoogleJsonWebSignature.Payload payload;
        try
        {
            payload = await GoogleJsonWebSignature.ValidateAsync(credential, settings);
        }
        catch (InvalidJwtException ex)
        {
            throw new UnauthorizedAccessException($"Token Google inválido: {ex.Message}");
        }

        return new GooglePayload(
            Subject: payload.Subject,
            Email:   payload.Email,
            Name:    payload.Name ?? payload.Email);
    }
}
