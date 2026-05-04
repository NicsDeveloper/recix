using System.Diagnostics;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Recix.Tests.Integration.Infrastructure;

/// <summary>
/// Base class para todos os testes de integração.
/// Compartilha a factory via IClassFixture e provê helpers de HTTP + polling.
/// </summary>
public abstract class IntegrationTestBase : IAsyncLifetime
{
    protected readonly RecixWebApplicationFactory Factory;
    protected HttpClient Client = default!;
    protected Guid OrgId;

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNameCaseInsensitive = true,
        Converters = { new JsonStringEnumConverter() },
    };

    protected IntegrationTestBase(RecixWebApplicationFactory factory)
    {
        Factory = factory;
    }

    // ── Ciclo de vida ─────────────────────────────────────────────────────────

    public async Task InitializeAsync()
    {
        await Factory.ResetAsync();
        var (orgId, token) = await Factory.SeedOwnerAsync();
        OrgId  = orgId;
        Client = Factory.CreateAuthenticatedClient(token);
    }

    public Task DisposeAsync()
    {
        Client.Dispose();
        return Task.CompletedTask;
    }

    // ── HTTP helpers ──────────────────────────────────────────────────────────

    protected async Task<T> PostJsonAsync<T>(string url, object body)
    {
        var res = await Client.PostAsJsonAsync(url, body);
        res.EnsureSuccessStatusCode();
        return (await res.Content.ReadFromJsonAsync<T>(JsonOpts))!;
    }

    protected async Task<T> GetJsonAsync<T>(string url)
    {
        var res = await Client.GetAsync(url);
        res.EnsureSuccessStatusCode();
        return (await res.Content.ReadFromJsonAsync<T>(JsonOpts))!;
    }

    protected async Task<HttpResponseMessage> PostRawAsync(string url, object body)
        => await Client.PostAsJsonAsync(url, body);

    // ── Polling ───────────────────────────────────────────────────────────────

    /// <summary>
    /// Policia até que a condição seja verdadeira, ou lança TimeoutException.
    /// Útil para aguardar o BackgroundService processar eventos assincronamente.
    /// </summary>
    protected static async Task<T> WaitUntilAsync<T>(
        Func<Task<T>> fetch,
        Func<T, bool> condition,
        int timeoutMs = 8_000,
        int pollIntervalMs = 250)
    {
        var sw = Stopwatch.StartNew();
        while (sw.ElapsedMilliseconds < timeoutMs)
        {
            var value = await fetch();
            if (condition(value)) return value;
            await Task.Delay(pollIntervalMs);
        }
        throw new TimeoutException(
            $"Condition not satisfied within {timeoutMs}ms. Last value: {await fetch()}");
    }

    // ── Builders de request ───────────────────────────────────────────────────

    protected static object WebhookBody(
        string referenceId,
        decimal paidAmount,
        string? externalChargeId = null,
        string? eventId = null) => new
        {
            eventId           = eventId ?? Guid.NewGuid().ToString(),
            referenceId,
            externalChargeId,
            paidAmount,
            paidAt            = DateTime.UtcNow,
            provider          = "IntegrationTest",
        };

    protected static object WebhookBodyNoRef(decimal paidAmount, string? eventId = null) => new
    {
        eventId    = eventId ?? Guid.NewGuid().ToString(),
        paidAmount,
        paidAt     = DateTime.UtcNow,
        provider   = "IntegrationTest",
    };
}

// ── DTOs de resposta (subset do que a API retorna) ────────────────────────────

public sealed record ChargeDto(
    Guid    Id,
    string  ReferenceId,
    string  ExternalId,
    decimal Amount,
    string  Status,
    DateTimeOffset ExpiresAt,
    DateTimeOffset CreatedAt);

public sealed record CreateChargeResponse(
    Guid    Id,
    string  ReferenceId,
    string  ExternalId,
    decimal Amount,
    string  Status,
    DateTimeOffset ExpiresAt,
    DateTimeOffset CreatedAt,
    string  PixCopiaECola);

// Corresponde a ReceivePixWebhookResponse no backend
public sealed record WebhookResponse(
    bool   Received,
    string EventId,
    string Status);

public sealed record PagedResult<T>(
    List<T> Items,
    int     TotalCount,
    int     Page,
    int     PageSize);

// Corresponde a ReconciliationDto no backend
public sealed record ReconciliationDto(
    Guid     Id,
    Guid?    ChargeId,
    Guid     PaymentEventId,
    string   Status,
    string   Reason,
    decimal? ExpectedAmount,
    decimal  PaidAmount,
    DateTime CreatedAt);

// Corresponde a PendingReviewListDto no backend
public sealed record PendingReviewListDto(
    int TotalCount,
    List<PendingReviewItemDto> Items);

// Corresponde a PendingReviewItemDto no backend
public sealed record PendingReviewItemDto(
    Guid     Id,
    Guid?    ChargeId,
    Guid?    PaymentEventId,
    string   Status,
    string   Confidence,
    string   MatchReason,
    decimal? ExpectedAmount,
    decimal  PaidAmount);
