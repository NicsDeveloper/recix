using Recix.Application.DTOs;
using Recix.Application.Interfaces;
using Recix.Domain.Entities;

namespace Recix.Application.UseCases;

/// <summary>
/// Verifica o credential (ID token) do Google Identity Services,
/// cria ou encontra o usuário e devolve um JWT próprio do RECIX.
/// </summary>
public sealed class GoogleAuthUseCase(
    IUserRepository users,
    IJwtService jwt,
    IGoogleTokenVerifier googleVerifier)
{
    public async Task<AuthResponse> ExecuteAsync(GoogleAuthRequest request, CancellationToken ct = default)
    {
        var payload = await googleVerifier.VerifyAsync(request.Credential, ct);

        // Tenta localizar por GoogleId primeiro; depois por e-mail (conta pré-existente)
        var user = await users.GetByGoogleIdAsync(payload.Subject, ct)
                ?? await users.GetByEmailAsync(payload.Email, ct);

        if (user is null)
        {
            user = User.CreateWithGoogle(payload.Email, payload.Name, payload.Subject);
            await users.AddAsync(user, ct);
        }
        else
        {
            // Vincula GoogleId se a conta foi criada com senha anteriormente
            if (user.GoogleId is null) user.LinkGoogle(payload.Subject);
            // Atualiza nome caso tenha mudado no Google
            user.SetName(payload.Name);
            user.RecordLogin();
            await users.UpdateAsync(user, ct);
        }

        return new AuthResponse
        {
            Token = jwt.GenerateToken(user),
            User  = new UserDto { Id = user.Id, Email = user.Email, Name = user.Name, Role = user.Role },
        };
    }
}
