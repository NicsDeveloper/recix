using System.Net.Http.Headers;
using System.Security.Cryptography.X509Certificates;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;
using Recix.Application.Interfaces;

namespace Recix.Infrastructure.Services;

/// <summary>
/// Provedor PIX real via API EfiBank (Gerencianet).
/// Documentação: https://dev.efipay.com.br/docs/api-pix/
/// </summary>
public sealed class EfiBankPixProvider : IPixProvider, IDisposable
{
    private readonly EfiBankOptions _options;
    private readonly HttpClient _http;
    private readonly ILogger<EfiBankPixProvider> _logger;

    // Cache do access token
    private string? _accessToken;
    private DateTime _tokenExpiresAt = DateTime.MinValue;
    private readonly SemaphoreSlim _tokenLock = new(1, 1);

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    public EfiBankPixProvider(EfiBankOptions options, ILogger<EfiBankPixProvider> logger)
    {
        _options = options;
        _logger = logger;
        _http = BuildHttpClient();
    }

    // ─── IPixProvider ────────────────────────────────────────────────────────

    public async Task<PixChargeResult> CreateChargeAsync(
        string referenceId, decimal amount, DateTime expiresAt, CancellationToken ct = default)
    {
        var token = await GetAccessTokenAsync(ct);
        var txId = SanitizeTxId(referenceId);
        var expiracaoSegundos = (int)(expiresAt - DateTime.UtcNow).TotalSeconds;

        var body = new
        {
            calendario = new { expiracao = Math.Max(expiracaoSegundos, 60) },
            valor = new { original = amount.ToString("F2", System.Globalization.CultureInfo.InvariantCulture) },
            chave = _options.PixKey,
            solicitacaoPagador = $"Pagamento {referenceId}"
        };

        var json = JsonSerializer.Serialize(body, JsonOpts);
        var request = new HttpRequestMessage(HttpMethod.Put, $"/v2/cob/{txId}")
        {
            Content = new StringContent(json, Encoding.UTF8, "application/json")
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        _logger.LogInformation("EfiBank: criando cobrança PIX txId={TxId} valor={Amount}", txId, amount);

        var response = await _http.SendAsync(request, ct);
        var responseBody = await response.Content.ReadAsStringAsync(ct);

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogError("EfiBank: falha ao criar cobrança. Status={Status} Body={Body}",
                response.StatusCode, responseBody);
            throw new InvalidOperationException($"EfiBank API error {response.StatusCode}: {responseBody}");
        }

        using var doc = JsonDocument.Parse(responseBody);
        var pixCopiaECola = doc.RootElement.GetProperty("pixCopiaECola").GetString()
            ?? throw new InvalidOperationException("EfiBank não retornou pixCopiaECola.");

        _logger.LogInformation("EfiBank: cobrança criada com sucesso. TxId={TxId}", txId);

        return new PixChargeResult(txId, pixCopiaECola);
    }

    public async Task RegisterWebhookAsync(string webhookUrl, CancellationToken ct = default)
    {
        var token = await GetAccessTokenAsync(ct);
        var chave = Uri.EscapeDataString(_options.PixKey);

        var body = new { webhookUrl };
        var json = JsonSerializer.Serialize(body, JsonOpts);
        var request = new HttpRequestMessage(HttpMethod.Put, $"/v2/webhook/{chave}")
        {
            Content = new StringContent(json, Encoding.UTF8, "application/json")
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await _http.SendAsync(request, ct);
        if (!response.IsSuccessStatusCode)
        {
            var err = await response.Content.ReadAsStringAsync(ct);
            _logger.LogError("EfiBank: falha ao registrar webhook. Status={Status} Body={Body}",
                response.StatusCode, err);
            throw new InvalidOperationException($"EfiBank webhook registration error: {err}");
        }

        _logger.LogInformation("EfiBank: webhook registrado em {Url}", webhookUrl);
    }

    // ─── OAuth2 token ─────────────────────────────────────────────────────────

    private async Task<string> GetAccessTokenAsync(CancellationToken ct)
    {
        if (_accessToken is not null && DateTime.UtcNow < _tokenExpiresAt)
            return _accessToken;

        await _tokenLock.WaitAsync(ct);
        try
        {
            // Double-check após aguardar o lock
            if (_accessToken is not null && DateTime.UtcNow < _tokenExpiresAt)
                return _accessToken;

            var credentials = Convert.ToBase64String(
                Encoding.UTF8.GetBytes($"{_options.ClientId}:{_options.ClientSecret}"));

            var request = new HttpRequestMessage(HttpMethod.Post, "/oauth/token")
            {
                Content = new StringContent(
                    """{"grant_type":"client_credentials"}""",
                    Encoding.UTF8, "application/json")
            };
            request.Headers.Authorization = new AuthenticationHeaderValue("Basic", credentials);

            var response = await _http.SendAsync(request, ct);
            var body = await response.Content.ReadAsStringAsync(ct);

            if (!response.IsSuccessStatusCode)
                throw new InvalidOperationException($"EfiBank auth failed {response.StatusCode}: {body}");

            using var doc = JsonDocument.Parse(body);
            _accessToken = doc.RootElement.GetProperty("access_token").GetString()
                ?? throw new InvalidOperationException("EfiBank: access_token ausente.");
            var expiresIn = doc.RootElement.GetProperty("expires_in").GetInt32();

            // Renova 60s antes de expirar
            _tokenExpiresAt = DateTime.UtcNow.AddSeconds(expiresIn - 60);

            _logger.LogDebug("EfiBank: token obtido, expira em {ExpiresAt}", _tokenExpiresAt);

            return _accessToken;
        }
        finally
        {
            _tokenLock.Release();
        }
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private HttpClient BuildHttpClient()
    {
        var handler = new HttpClientHandler();

        if (!string.IsNullOrWhiteSpace(_options.CertificatePath) &&
            File.Exists(_options.CertificatePath))
        {
            var cert = new X509Certificate2(
                _options.CertificatePath,
                _options.CertificatePassword,
                X509KeyStorageFlags.PersistKeySet);

            handler.ClientCertificates.Add(cert);
            _logger.LogInformation("EfiBank: certificado mTLS carregado de {Path}", _options.CertificatePath);
        }
        else
        {
            _logger.LogWarning("EfiBank: certificado não encontrado em '{Path}' — chamadas sem mTLS.", _options.CertificatePath);
        }

        // Sandbox usa certificado auto-assinado — aceita qualquer cert do servidor
        if (_options.IsSandbox)
            handler.ServerCertificateCustomValidationCallback = HttpClientHandler.DangerousAcceptAnyServerCertificateValidator;

        return new HttpClient(handler) { BaseAddress = new Uri(_options.ApiBaseUrl) };
    }

    /// <summary>EfiBank exige txid alfanumérico [a-zA-Z0-9]{1,35} — remove hífens.</summary>
    public static string SanitizeTxId(string referenceId) =>
        referenceId.Replace("-", "").Replace("_", "");

    /// <summary>Reconstrói o ReferenceId a partir do txid (RECIX20260429000001 → RECIX-20260429-000001).</summary>
    public static string RestoreReferenceId(string txId)
    {
        var m = System.Text.RegularExpressions.Regex.Match(txId, @"^RECIX(\d{8})(\d{6})$");
        return m.Success ? $"RECIX-{m.Groups[1].Value}-{m.Groups[2].Value}" : txId;
    }

    public void Dispose()
    {
        _http.Dispose();
        _tokenLock.Dispose();
    }
}
