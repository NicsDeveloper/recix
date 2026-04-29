using System.Text.Json;
using Recix.Application.DTOs;

namespace Recix.Infrastructure.Services;

/// <summary>
/// Converte o payload do webhook EfiBank para o DTO interno ReceivePixWebhookRequest.
///
/// Formato EfiBank recebido:
/// {
///   "pix": [{
///     "endToEndId": "E09089356...",
///     "txid": "RECIX20260429000001",
///     "chave": "sua-chave-pix",
///     "valor": "150.75",
///     "horario": "2026-04-29T10:30:00.000Z",
///     "infoPagador": "mensagem opcional"
///   }]
/// }
/// </summary>
public static class EfiBankWebhookAdapter
{
    public static IEnumerable<ReceivePixWebhookRequest> Adapt(string rawBody)
    {
        using var doc = JsonDocument.Parse(rawBody);

        if (!doc.RootElement.TryGetProperty("pix", out var pixArray))
            yield break;

        foreach (var pix in pixArray.EnumerateArray())
        {
            var endToEndId = pix.GetProperty("endToEndId").GetString() ?? string.Empty;
            var txId       = pix.TryGetProperty("txid", out var t) ? t.GetString() ?? string.Empty : string.Empty;
            var valor      = pix.GetProperty("valor").GetString() ?? "0";
            var horario    = pix.GetProperty("horario").GetString() ?? DateTime.UtcNow.ToString("O");

            // Reconstrói o ReferenceId a partir do txid
            var referenceId = EfiBankPixProvider.RestoreReferenceId(txId);

            yield return new ReceivePixWebhookRequest
            {
                EventId          = endToEndId,        // endToEndId é o identificador único do pagamento
                ExternalChargeId = null,               // EfiBank usa txid/referenceId, não externalId
                ReferenceId      = referenceId,        // RECIX-20260429-000001
                PaidAmount       = decimal.Parse(valor, System.Globalization.CultureInfo.InvariantCulture),
                PaidAt           = DateTime.Parse(horario, null, System.Globalization.DateTimeStyles.RoundtripKind),
                Provider         = "EfiBank"
            };
        }
    }
}
