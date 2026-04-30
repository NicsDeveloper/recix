using Microsoft.Extensions.Logging;
using Recix.Application.DTOs;

namespace Recix.Application.UseCases;

/// <summary>
/// Importa um extrato bancário em CSV e dispara a reconciliação de cada linha.
///
/// Formato esperado (primeira linha = cabeçalho):
///   eventId,paidAmount,paidAt,referenceId,externalChargeId,provider
///
/// Campos obrigatórios: eventId, paidAmount, paidAt
/// Campos opcionais:    referenceId, externalChargeId, provider (default = "Import")
/// </summary>
public sealed class ImportBankStatementUseCase(
    ReceivePixWebhookUseCase webhookUseCase,
    ILogger<ImportBankStatementUseCase> logger)
{
    public async Task<ImportStatementResult> ExecuteAsync(
        Stream csvStream,
        CancellationToken ct = default)
    {
        using var reader = new StreamReader(csvStream, leaveOpen: true);
        var lines = new List<string>();
        while (await reader.ReadLineAsync(ct) is { } line)
            lines.Add(line);

        if (lines.Count == 0)
            return new ImportStatementResult();

        // Detecta e pula cabeçalho
        var startIndex = 0;
        if (lines[0].Contains("eventId", StringComparison.OrdinalIgnoreCase) ||
            lines[0].Contains("event_id", StringComparison.OrdinalIgnoreCase))
            startIndex = 1;

        var results  = new List<ImportStatementLineResult>();
        int imported = 0, duplicates = 0, errors = 0;

        for (var i = startIndex; i < lines.Count; i++)
        {
            var raw  = lines[i].Trim();
            if (string.IsNullOrEmpty(raw)) continue;

            var lineNum = i + 1;
            var cols    = SplitCsv(raw);

            if (cols.Length < 3)
            {
                errors++;
                results.Add(new ImportStatementLineResult
                {
                    Line    = lineNum,
                    EventId = cols.Length > 0 ? cols[0] : "",
                    Status  = "Error",
                    Error   = "Linha deve ter ao menos 3 colunas: eventId, paidAmount, paidAt",
                });
                continue;
            }

            var eventId          = cols[0].Trim();
            var amountRaw        = cols[1].Trim();
            var paidAtRaw        = cols[2].Trim();
            var referenceId      = cols.Length > 3 ? cols[3].Trim() : null;
            var externalChargeId = cols.Length > 4 ? cols[4].Trim() : null;
            var provider         = cols.Length > 5 && !string.IsNullOrWhiteSpace(cols[5]) ? cols[5].Trim() : "Import";

            if (string.IsNullOrWhiteSpace(eventId))
            {
                errors++;
                results.Add(new ImportStatementLineResult { Line = lineNum, EventId = "", Status = "Error", Error = "eventId vazio." });
                continue;
            }

            if (!decimal.TryParse(amountRaw.Replace(',', '.'), System.Globalization.NumberStyles.Any,
                    System.Globalization.CultureInfo.InvariantCulture, out var paidAmount) || paidAmount <= 0)
            {
                errors++;
                results.Add(new ImportStatementLineResult { Line = lineNum, EventId = eventId, Status = "Error", Error = $"paidAmount inválido: '{amountRaw}'." });
                continue;
            }

            if (!DateTime.TryParse(paidAtRaw, null, System.Globalization.DateTimeStyles.RoundtripKind, out var paidAt))
            {
                errors++;
                results.Add(new ImportStatementLineResult { Line = lineNum, EventId = eventId, Status = "Error", Error = $"paidAt inválido: '{paidAtRaw}'." });
                continue;
            }

            try
            {
                var request = new ReceivePixWebhookRequest
                {
                    EventId          = eventId,
                    PaidAmount       = paidAmount,
                    PaidAt           = paidAt.ToUniversalTime(),
                    ReferenceId      = string.IsNullOrWhiteSpace(referenceId)      ? null : referenceId,
                    ExternalChargeId = string.IsNullOrWhiteSpace(externalChargeId) ? null : externalChargeId,
                    Provider         = provider,
                };

                var response = await webhookUseCase.ExecuteAsync(request, ct);

                if (response.Status == "IgnoredDuplicate")
                {
                    duplicates++;
                    results.Add(new ImportStatementLineResult { Line = lineNum, EventId = eventId, Status = "Duplicate" });
                }
                else
                {
                    imported++;
                    results.Add(new ImportStatementLineResult { Line = lineNum, EventId = eventId, Status = "Imported" });
                }
            }
            catch (Exception ex)
            {
                errors++;
                logger.LogWarning(ex, "Erro ao importar linha {Line} EventId={EventId}", lineNum, eventId);
                results.Add(new ImportStatementLineResult { Line = lineNum, EventId = eventId, Status = "Error", Error = ex.Message });
            }
        }

        logger.LogInformation("Import concluído: {Imported} importados, {Duplicates} duplicados, {Errors} erros",
            imported, duplicates, errors);

        return new ImportStatementResult
        {
            Imported   = imported,
            Duplicates = duplicates,
            Errors     = errors,
            Lines      = results,
        };
    }

    // RFC 4180-ish splitter (suporta campos entre aspas)
    private static string[] SplitCsv(string line)
    {
        var fields = new List<string>();
        var current = new System.Text.StringBuilder();
        var inQuotes = false;

        for (var i = 0; i < line.Length; i++)
        {
            var ch = line[i];
            if (ch == '"')
            {
                if (inQuotes && i + 1 < line.Length && line[i + 1] == '"') { current.Append('"'); i++; }
                else inQuotes = !inQuotes;
            }
            else if (ch == ',' && !inQuotes)
            {
                fields.Add(current.ToString());
                current.Clear();
            }
            else
            {
                current.Append(ch);
            }
        }
        fields.Add(current.ToString());
        return fields.ToArray();
    }
}
