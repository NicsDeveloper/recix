using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Recix.Application.Interfaces;
using Recix.Application.Services;
using Recix.Application.UseCases;
using Recix.Domain.Enums;

namespace Recix.Infrastructure.BackgroundServices;

public sealed class PaymentEventProcessorService : BackgroundService
{
    /// <summary>Quando não há sinal de webhook, varre a fila neste intervalo (stuck recovery, retries).</summary>
    private static readonly TimeSpan IdlePollInterval = TimeSpan.FromSeconds(2);

    private static readonly TimeSpan StuckProcessingThreshold = TimeSpan.FromMinutes(2);
    private static readonly TimeSpan FailedRetryDelay = TimeSpan.FromSeconds(20);
    private const int BatchSize = 10;

    private readonly IServiceScopeFactory    _scopeFactory;
    private readonly IEventBroadcaster       _broadcaster;
    private readonly IPaymentProcessorWake   _wake;
    private readonly PaymentReliabilityMetrics _metrics;
    private readonly ILogger<PaymentEventProcessorService> _logger;

    public PaymentEventProcessorService(
        IServiceScopeFactory scopeFactory,
        IEventBroadcaster broadcaster,
        IPaymentProcessorWake wake,
        PaymentReliabilityMetrics metrics,
        ILogger<PaymentEventProcessorService> logger)
    {
        _scopeFactory = scopeFactory;
        _broadcaster  = broadcaster;
        _wake         = wake;
        _metrics      = metrics;
        _logger       = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("PaymentEventProcessorService started (idle poll {IdlePoll}s + instant wake on webhook).",
            IdlePollInterval.TotalSeconds);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await _wake.WaitForPulseOrTimeoutAsync(IdlePollInterval, stoppingToken);
                // Processa em cadeia enquanto houver fila (um webhook pode enfileirar muitos eventos)
                for (var round = 0; round < 200 && !stoppingToken.IsCancellationRequested; round++)
                {
                    if (!await ProcessBatchAsync(stoppingToken))
                        break;
                }
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                // Loop never dies — only individual event failures propagate inside ProcessBatchAsync
                _logger.LogError(ex, "Unexpected error in PaymentEventProcessorService loop.");
            }
        }

        _logger.LogInformation("PaymentEventProcessorService stopped.");
    }

    /// <returns><see langword="true"/> se processou pelo menos um evento de pagamento em estado Received.</returns>
    private async Task<bool> ProcessBatchAsync(CancellationToken stoppingToken)
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
            return false;

        _logger.LogInformation("Processing batch of {Count} payment event(s).", pending.Count);

        foreach (var evt in pending)
        {
            if (stoppingToken.IsCancellationRequested)
                break;

            try
            {
                await useCase.ExecuteAsync(evt.Id, stoppingToken);

                // Notifica clientes SSE/SignalR que houve mudança (orgId vem da entidade)
                _broadcaster.Publish(RecixEvent.PaymentEventUpdated(evt.Id, evt.OrganizationId));
            }
            catch (Exception ex)
            {
                // Individual event failure — already handled inside use case, but guard here too
                _logger.LogError(ex, "Unhandled error processing PaymentEvent {PaymentEventId}.", evt.Id);
            }
        }

        return true;
    }
}
