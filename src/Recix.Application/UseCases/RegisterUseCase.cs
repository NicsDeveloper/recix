using Recix.Application.DTOs;
using Recix.Application.Interfaces;
using Recix.Domain.Entities;

namespace Recix.Application.UseCases;

public sealed class RegisterUseCase(
    IUserRepository users,
    IJwtService jwt,
    IPasswordHasher hasher)
{
    public async Task<AuthResponse> ExecuteAsync(RegisterRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Email))
            throw new ArgumentException("E-mail é obrigatório.");

        if (string.IsNullOrWhiteSpace(request.Password) || request.Password.Length < 6)
            throw new ArgumentException("Senha deve ter pelo menos 6 caracteres.");

        if (string.IsNullOrWhiteSpace(request.Name))
            throw new ArgumentException("Nome é obrigatório.");

        if (await users.ExistsAsync(request.Email, ct))
            throw new InvalidOperationException("Já existe uma conta com este e-mail.");

        var hash = hasher.Hash(request.Password);
        var user = User.CreateWithPassword(request.Email, request.Name, hash);
        await users.AddAsync(user, ct);

        return BuildResponse(user);
    }

    private AuthResponse BuildResponse(User user) => new()
    {
        Token = jwt.GenerateToken(user),
        User  = new UserDto { Id = user.Id, Email = user.Email, Name = user.Name, Role = user.Role },
    };
}
