using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Recix.Application.Services;
using Recix.Application.Interfaces;
using Recix.Application.UseCases;
using Recix.Domain.Enums;

namespace Recix.Infrastructure.BackgroundServices;

public sealed class PaymentEventProcessorService : BackgroundService
{
    private static readonly TimeSpan PollingInterval = TimeSpan.FromSeconds(5);
    private static readonly TimeSpan StuckProcessingThreshold = TimeSpan.FromMinutes(2);
    private static readonly TimeSpan FailedRetryDelay = TimeSpan.FromSeconds(20);
    private const int BatchSize = 10;

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IEventBroadcaster _broadcaster;
    private readonly PaymentReliabilityMetrics _metrics;
    private readonly ILogger<PaymentEventProcessorService> _logger;

    public PaymentEventProcessorService(
        IServiceScopeFactory scopeFactory,
        IEventBroadcaster broadcaster,
        PaymentReliabilityMetrics metrics,
        ILogger<PaymentEventProcessorService> logger)
    {
        _scopeFactory = scopeFactory;
        _broadcaster = broadcaster;
        _metrics = metrics;
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

        var recovered = await eventRepo.RecoverStuckProcessingAsync(StuckProcessingThreshold, stoppingToken);
        if (recovered > 0)
        {
            _metrics.IncrementStuckRecovered(recovered);
            _logger.LogWarning("Recovered {Count} stuck payment event(s) in Processing state.", recovered);
        }

        var failedPage = await eventRepo.ListAsync(PaymentEventStatus.Failed, 1, BatchSize, stoppingToken);
        var retryable = failedPage.Items
            .Where(e => e.ProcessedAt.HasValue && e.ProcessedAt.Value <= DateTime.UtcNow - FailedRetryDelay)
            .ToList();

        foreach (var evt in retryable)
        {
            try
            {
                evt.RequeueForRetry();
                await eventRepo.UpdateAsync(evt, stoppingToken);
                _logger.LogInformation("Requeued failed payment event {PaymentEventId} for retry.", evt.Id);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to requeue payment event {PaymentEventId}.", evt.Id);
            }
        }

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
            }
            catch (Exception ex)
            {
                // Individual event failure — already handled inside use case, but guard here too
                _logger.LogError(ex, "Unhandled error processing PaymentEvent {PaymentEventId}.", evt.Id);
            }
        }
    }
}
