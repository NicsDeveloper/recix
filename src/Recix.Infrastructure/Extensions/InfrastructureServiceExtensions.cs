using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
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

        services.AddScoped<IChargeRepository, ChargeRepository>();
        services.AddScoped<IPaymentEventRepository, PaymentEventRepository>();
        services.AddScoped<IReconciliationRepository, ReconciliationRepository>();
        services.AddScoped<IAiInsightService, FakeAiInsightService>();

        services.AddScoped<ReconciliationEngine>();
        services.AddScoped<CreateChargeUseCase>();
        services.AddScoped<ReceivePixWebhookUseCase>();
        services.AddScoped<ProcessPaymentEventUseCase>();
        services.AddScoped<DashboardQueryService>();

        // PIX Provider: EfiBank (real) quando configurado, Fake caso contrário
        services.Configure<EfiBankOptions>(configuration.GetSection(EfiBankOptions.SectionName));
        var efiBankOptions = configuration.GetSection(EfiBankOptions.SectionName).Get<EfiBankOptions>() ?? new EfiBankOptions();
        if (efiBankOptions.IsConfigured)
            services.AddSingleton<IPixProvider, EfiBankPixProvider>();
        else
            services.AddSingleton<IPixProvider, FakePixProvider>();

        // Singleton: mantém a lista de subscribers SSE entre requests
        services.AddSingleton<IEventBroadcaster, InMemoryEventBroadcaster>();

        services.AddHostedService<PaymentEventProcessorService>();
        services.AddHostedService<ExpirationSweepService>();

        return services;
    }

    public static async Task MigrateAsync(this IServiceProvider services)
    {
        await using var scope = services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<RecixDbContext>();
        await db.Database.MigrateAsync();
    }
}
