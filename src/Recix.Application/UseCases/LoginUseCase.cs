using Recix.Application.DTOs;
using Recix.Application.Interfaces;
using Recix.Domain.Entities;

namespace Recix.Application.UseCases;

public sealed class LoginUseCase(
    IUserRepository users,
    IJwtService jwt,
    IPasswordHasher hasher)
{
    public async Task<AuthResponse> ExecuteAsync(LoginRequest request, CancellationToken ct = default)
    {
        var user = await users.GetByEmailAsync(request.Email, ct)
            ?? throw new UnauthorizedAccessException("E-mail ou senha incorretos.");

        if (string.IsNullOrEmpty(user.PasswordHash))
            throw new UnauthorizedAccessException("Esta conta usa login com Google. Use o botão 'Entrar com Google'.");

        if (!hasher.Verify(request.Password, user.PasswordHash))
            throw new UnauthorizedAccessException("E-mail ou senha incorretos.");

        user.RecordLogin();
        await users.UpdateAsync(user, ct);

        return new AuthResponse
        {
            Token = jwt.GenerateToken(user),
            User  = new UserDto { Id = user.Id, Email = user.Email, Name = user.Name, Role = user.Role },
        };
    }
}
