using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Recix.Application.Interfaces;
using Recix.Application.UseCases;
using Recix.Domain.Enums;

namespace Recix.Infrastructure.BackgroundServices;

public sealed class PaymentEventProcessorService : BackgroundService
{
    private static readonly TimeSpan PollingInterval = TimeSpan.FromSeconds(5);
    private const int BatchSize = 10;

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IEventBroadcaster _broadcaster;
    private readonly ILogger<PaymentEventProcessorService> _logger;

    public PaymentEventProcessorService(
        IServiceScopeFactory scopeFactory,
        IEventBroadcaster broadcaster,
        ILogger<PaymentEventProcessorService> logger)
    {
        _scopeFactory = scopeFactory;
        _broadcaster = broadcaster;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("PaymentEventProcessorService started.");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessBatchAsync(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                // Loop never dies — only individual event failures propagate inside ProcessBatchAsync
                _logger.LogError(ex, "Unexpected error in PaymentEventProcessorService loop.");
            }

            await Task.Delay(PollingInterval, stoppingToken);
        }

        _logger.LogInformation("PaymentEventProcessorService stopped.");
    }

    private async Task ProcessBatchAsync(CancellationToken stoppingToken)
    {
        await using var scope = _scopeFactory.CreateAsyncScope();
        var eventRepo = scope.ServiceProvider.GetRequiredService<IPaymentEventRepository>();
        var useCase = scope.ServiceProvider.GetRequiredService<ProcessPaymentEventUseCase>();

        var pending = await eventRepo.GetByStatusAsync(PaymentEventStatus.Received, BatchSize, stoppingToken);

        if (pending.Count == 0)
            return;

        _logger.LogInformation("Processing batch of {Count} payment event(s).", pending.Count);

        foreach (var evt in pending)
        {
            if (stoppingToken.IsCancellationRequested)
                break;

            try
            {
                await useCase.ExecuteAsync(evt.Id, stoppingToken);

                // Notifica clientes SSE que houve mudança
                _broadcaster.Publish(RecixEvent.PaymentEventUpdated(evt.Id));
                _broadcaster.Publish(RecixEvent.ChargeUpdated(evt.Id)); // frontend invalida charges também
            }
            catch (Exception ex)
            {
                // Individual event failure — already handled inside use case, but guard here too
                _logger.LogError(ex, "Unhandled error processing PaymentEvent {PaymentEventId}.", evt.Id);
            }
        }
    }
}
