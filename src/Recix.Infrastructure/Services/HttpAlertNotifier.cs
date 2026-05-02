using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Recix.Application.Interfaces;
using Recix.Domain.Enums;

namespace Recix.Infrastructure.Services;

/// <summary>
/// Quando uma divergência é detectada, verifica a configuração de alertas da org
/// e dispara um HTTP POST para a URL configurada.
///
/// A notificação é best-effort: falhas são logadas mas nunca relançadas,
/// para não bloquear o pipeline de reconciliação.
/// </summary>
public sealed class HttpAlertNotifier(
    IOrgAlertConfigRepository alertConfigRepo,
    IHttpClientFactory httpClientFactory,
    ILogger<HttpAlertNotifier> logger) : IAlertNotifier
{
    private static readonly IReadOnlySet<ReconciliationStatus> AlertableStatuses = new HashSet<ReconciliationStatus>
    {
        ReconciliationStatus.AmountMismatch,
        ReconciliationStatus.PaymentExceedsExpected,
        ReconciliationStatus.DuplicatePayment,
        ReconciliationStatus.PaymentWithoutCharge,
        ReconciliationStatus.ExpiredChargePaid,
    };

    public async Task NotifyAsync(
        Guid orgId,
        ReconciliationStatus status,
        Guid? chargeId,
        Guid paymentEventId,
        decimal? expectedAmount,
        decimal paidAmount,
        string reason,
        CancellationToken ct = default)
    {
        if (!AlertableStatuses.Contains(status)) return;

        try
        {
            var config = await alertConfigRepo.GetByOrgIdAsync(orgId, ct);
            if (config is null || string.IsNullOrWhiteSpace(config.WebhookUrl)) return;

            if (!ShouldNotify(config, status)) return;

            var payload = new
            {
                @event         = "reconciliation.divergence",
                orgId          = orgId.ToString(),
                status         = status.ToString(),
                chargeId       = chargeId?.ToString(),
                paymentEventId = paymentEventId.ToString(),
                expectedAmount,
                paidAmount,
                reason,
                detectedAt     = DateTime.UtcNow,
                source         = "RECIX Engine",
            };

            var json    = JsonSerializer.Serialize(payload, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            using var client = httpClientFactory.CreateClient("AlertNotifier");
            using var cts    = CancellationTokenSource.CreateLinkedTokenSource(ct);
            cts.CancelAfter(TimeSpan.FromSeconds(10));

            var response = await client.PostAsync(config.WebhookUrl, content, cts.Token);

            if (!response.IsSuccessStatusCode)
                logger.LogWarning("[AlertNotifier] Webhook retornou {StatusCode} para org {OrgId}", response.StatusCode, orgId);
            else
                logger.LogInformation("[AlertNotifier] Notificação enviada: status={Status} org={OrgId}", status, orgId);
        }
        catch (Exception ex)
        {
            // Best-effort: loga mas não relança
            logger.LogWarning(ex, "[AlertNotifier] Falha ao notificar org {OrgId} status={Status}", orgId, status);
        }
    }

    private static bool ShouldNotify(Domain.Entities.OrgAlertConfig config, ReconciliationStatus status) => status switch
    {
        ReconciliationStatus.AmountMismatch          => config.NotifyAmountMismatch,
        ReconciliationStatus.PaymentExceedsExpected => config.NotifyAmountMismatch,
        ReconciliationStatus.DuplicatePayment      => config.NotifyDuplicatePayment,
        ReconciliationStatus.PaymentWithoutCharge  => config.NotifyPaymentWithoutCharge,
        ReconciliationStatus.ExpiredChargePaid     => config.NotifyExpiredChargePaid,
        _                                           => false,
    };
}
