using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using Recix.Application.Interfaces;
using Recix.Application.Services;
using Recix.Application.UseCases;
using Recix.Infrastructure.BackgroundServices;
using Recix.Infrastructure.Persistence;
using Recix.Infrastructure.Repositories;
using Recix.Infrastructure.Services;

namespace Recix.Infrastructure.Extensions;

public static class InfrastructureServiceExtensions
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddDbContext<RecixDbContext>(options =>
            options.UseNpgsql(configuration.GetConnectionString("DefaultConnection")));

        // ICurrentOrganization: HTTP requests usam claims do JWT; background services usam SystemOrgContext
        services.AddHttpContextAccessor();
        services.AddScoped<ICurrentOrganization, HttpCurrentOrganization>();

        services.AddScoped<IChargeRepository, ChargeRepository>();
        services.AddScoped<IPaymentEventRepository, PaymentEventRepository>();
        services.AddScoped<IReconciliationRepository, ReconciliationRepository>();
        services.AddScoped<IUserRepository, UserRepository>();
        services.AddScoped<IOrganizationRepository, OrganizationRepository>();
        services.AddScoped<IOrganizationJoinRequestRepository, OrganizationJoinRequestRepository>();
        services.AddScoped<IOrgAlertConfigRepository, OrgAlertConfigRepository>();
        services.AddScoped<IAiInsightService, FakeAiInsightService>();

        services.AddScoped<ReconciliationEngine>();
        services.AddScoped<CreateChargeUseCase>();
        services.AddScoped<ReceivePixWebhookUseCase>();
        services.AddScoped<ProcessPaymentEventUseCase>();
        services.AddScoped<DashboardQueryService>();
        services.AddScoped<RegisterUseCase>();
        services.AddScoped<LoginUseCase>();
        services.AddScoped<GoogleAuthUseCase>();
        services.AddScoped<SwitchOrgUseCase>();
        services.AddScoped<ReviewJoinRequestUseCase>();
        services.AddScoped<RefreshSessionUseCase>();
        services.AddScoped<OrgSetupUseCase>();
        services.AddScoped<ImportBankStatementUseCase>();
        services.AddScoped<ImportSalesUseCase>();
        services.AddScoped<ReviewReconciliationUseCase>();
        services.AddSingleton<PaymentReliabilityMetrics>();

        // ─── Auth ─────────────────────────────────────────────────────────────────
        services.AddSingleton<IPasswordHasher, BcryptPasswordHasher>();

        var jwtOptions = configuration.GetSection(JwtOptions.SectionName).Get<JwtOptions>() ?? new JwtOptions();
        services.AddSingleton(jwtOptions);
        services.AddSingleton<IJwtService, JwtService>();

        var googleOptions = configuration.GetSection(GoogleOptions.SectionName).Get<GoogleOptions>() ?? new GoogleOptions();
        services.AddSingleton(googleOptions);
        services.AddSingleton<IGoogleTokenVerifier, GoogleTokenVerifier>();

        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(opts =>
            {
                opts.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer           = true,
                    ValidateAudience         = true,
                    ValidateLifetime         = true,
                    ValidateIssuerSigningKey = true,
                    ValidIssuer              = jwtOptions.Issuer,
                    ValidAudience            = jwtOptions.Audience,
                    IssuerSigningKey         = new SymmetricSecurityKey(
                        Encoding.UTF8.GetBytes(jwtOptions.Secret)),
                };

                // SignalR WebSocket: token via query string ?access_token=...
                opts.Events = new Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerEvents
                {
                    OnMessageReceived = ctx =>
                    {
                        var token = ctx.Request.Query["access_token"].ToString();
                        if (!string.IsNullOrEmpty(token) &&
                            ctx.Request.Path.StartsWithSegments("/hubs"))
                        {
                            ctx.Token = token;
                        }
                        return Task.CompletedTask;
                    }
                };
            });

        services.AddAuthorizationBuilder()
            .SetFallbackPolicy(new Microsoft.AspNetCore.Authorization.AuthorizationPolicyBuilder()
                .RequireAuthenticatedUser()
                .Build());

        // ─── PIX Provider: EfiBank (real) quando configurado, Fake caso contrário
        services.Configure<EfiBankOptions>(configuration.GetSection(EfiBankOptions.SectionName));
        var efiBankOptions = configuration.GetSection(EfiBankOptions.SectionName).Get<EfiBankOptions>() ?? new EfiBankOptions();
        if (efiBankOptions.IsConfigured)
            services.AddSingleton<IPixProvider, EfiBankPixProvider>();
        else
            services.AddSingleton<IPixProvider, FakePixProvider>();

        // Singleton: mantém a lista de subscribers SSE entre requests
        services.AddSingleton<IEventBroadcaster, InMemoryEventBroadcaster>();

        // Notificador de alertas (outbound webhook)
        services.AddHttpClient("AlertNotifier");
        services.AddScoped<IAlertNotifier, HttpAlertNotifier>();

        services.AddHostedService<PaymentEventProcessorService>();
        services.AddHostedService<ExpirationSweepService>();
        // SignalRBridgeService é registrado em Program.cs (vive em Recix.Api)

        return services;
    }

    public static async Task MigrateAsync(this IServiceProvider services)
    {
        await using var scope = services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<RecixDbContext>();
        await db.Database.MigrateAsync();
    }
}
