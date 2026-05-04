using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Npgsql;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Recix.Application.Interfaces;
using Recix.Domain.Entities;
using Recix.Infrastructure.Persistence;

namespace Recix.Tests.Integration.Infrastructure;

/// <summary>
/// Factory compartilhada entre todas as classes de teste de integração.
/// Sobe o app real contra o banco recix_test e roda migrations na inicialização.
/// </summary>
public sealed class RecixWebApplicationFactory
    : WebApplicationFactory<Program>, IAsyncLifetime
{
    private const string TestDb =
        "Host=localhost;Port=5432;Database=recix_test;Username=recix;Password=recix123";

    // ── WebApplicationFactory setup ───────────────────────────────────────────

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");

        builder.ConfigureAppConfiguration((_, cfg) =>
        {
            cfg.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:DefaultConnection"] = TestDb,
                // Chave JWT idêntica ao appsettings — testes geram tokens válidos
                ["Jwt:Secret"]    = "recix-dev-secret-change-in-production-!!!",
                ["Jwt:Issuer"]    = "recix-api",
                ["Jwt:Audience"]  = "recix-frontend",
                ["Jwt:ExpiresInMinutes"] = "60",
            });
        });
    }

    // ── IAsyncLifetime ────────────────────────────────────────────────────────

    public async Task InitializeAsync()
    {
        // Cria o banco de teste se ainda não existir, depois roda as migrations.
        await EnsureDatabaseCreatedAsync();

        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<RecixDbContext>();
        await db.Database.MigrateAsync();
        await TruncateAsync(db);
    }

    private static async Task EnsureDatabaseCreatedAsync()
    {
        // Conecta no banco padrão (postgres) para poder criar recix_test.
        const string adminConn =
            "Host=localhost;Port=5432;Database=postgres;Username=recix;Password=recix123";

        await using var conn = new Npgsql.NpgsqlConnection(adminConn);
        await conn.OpenAsync();

        await using var check = new Npgsql.NpgsqlCommand(
            "SELECT 1 FROM pg_database WHERE datname = 'recix_test'", conn);
        var exists = await check.ExecuteScalarAsync();

        if (exists is null)
        {
            await using var create = new Npgsql.NpgsqlCommand(
                "CREATE DATABASE recix_test", conn);
            await create.ExecuteNonQueryAsync();
        }
    }

    public new async Task DisposeAsync()
    {
        await base.DisposeAsync();
    }

    // ── Helpers públicos ──────────────────────────────────────────────────────

    /// <summary>Trunca todas as tabelas — chame entre testes para isolamento.</summary>
    public async Task ResetAsync()
    {
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<RecixDbContext>();
        await TruncateAsync(db);
    }

    /// <summary>Cria usuário Owner + Organização, retorna token JWT válido.</summary>
    public async Task<(Guid orgId, string token)> SeedOwnerAsync(string name = "Test Owner")
    {
        using var scope = Services.CreateScope();
        var db     = scope.ServiceProvider.GetRequiredService<RecixDbContext>();
        var jwt    = scope.ServiceProvider.GetRequiredService<IJwtService>();
        var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();

        var user   = User.CreateWithPassword($"{Guid.NewGuid():N}@test.com", name, hasher.Hash("Test123!"));
        var org    = Organization.Create($"Org-{Guid.NewGuid():N}"[..14]);
        var member = OrganizationMember.Create(org.Id, user.Id, OrgRoles.Owner);

        db.Users.Add(user);
        db.Organizations.Add(org);
        db.OrganizationMembers.Add(member);
        await db.SaveChangesAsync();

        var token = jwt.GenerateToken(user, org.Id, OrgRoles.Owner);
        return (org.Id, token);
    }

    /// <summary>HttpClient com Authorization header já configurado.</summary>
    public HttpClient CreateAuthenticatedClient(string token)
    {
        var client = CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
        });
        client.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    // ── Privado ───────────────────────────────────────────────────────────────

    private static async Task TruncateAsync(RecixDbContext db)
    {
        // Ordem respeita FKs; RESTART IDENTITY zera sequências.
        await db.Database.ExecuteSqlRawAsync("""
            TRUNCATE TABLE
                payment_allocations,
                reconciliation_results,
                payment_events,
                charges,
                org_alert_configs,
                organization_join_requests,
                organization_members,
                organizations,
                users
            RESTART IDENTITY CASCADE;
            """);
    }
}
