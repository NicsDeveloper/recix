namespace Recix.Application.Interfaces;

public sealed record GooglePayload(string Subject, string Email, string Name);

public interface IGoogleTokenVerifier
{
    Task<GooglePayload> VerifyAsync(string credential, CancellationToken ct = default);
}
