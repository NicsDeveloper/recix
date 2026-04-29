using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using Recix.Application.Interfaces;
using Recix.Domain.Entities;

namespace Recix.Infrastructure.Services;

public sealed class JwtService : IJwtService
{
    private readonly JwtOptions _options;

    public JwtService(JwtOptions options) => _options = options;

    public string GenerateToken(User user, Guid? organizationId, string? orgRole)
    {
        var key   = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_options.Secret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claimList = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub,   user.Id.ToString()),
            new(JwtRegisteredClaimNames.Email, user.Email),
            new(JwtRegisteredClaimNames.Name,  user.Name),
            new(JwtRegisteredClaimNames.Jti,   Guid.NewGuid().ToString()),
        };

        if (organizationId.HasValue)
            claimList.Add(new Claim("org_id", organizationId.Value.ToString()));

        if (!string.IsNullOrEmpty(orgRole))
            claimList.Add(new Claim(ClaimTypes.Role, orgRole));

        var claims = claimList.ToArray();

        var token = new JwtSecurityToken(
            issuer:             _options.Issuer,
            audience:           _options.Audience,
            claims:             claims,
            expires:            DateTime.UtcNow.AddMinutes(_options.ExpiresInMinutes),
            signingCredentials: creds);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
