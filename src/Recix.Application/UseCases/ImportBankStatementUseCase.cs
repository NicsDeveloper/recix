using System.Text.RegularExpressions;
using Microsoft.Extensions.Logging;
using Recix.Application.DTOs;
using Recix.Application.Services;

namespace Recix.Application.UseCases;

/// <summary>
/// Importa um extrato bancário em CSV ou OFX e dispara a reconciliação de cada linha.
///
/// CSV — Formato esperado (primeira linha = cabeçalho):
///   eventId,paidAmount,paidAt,referenceId,externalChargeId,provider
///   Campos obrigatórios: eventId, paidAmount, paidAt
///
/// OFX — Formato padrão exportado pelos bancos brasileiros (SGML ou XML).
///   Extrai automaticamente FITID, TRNAMT, DTPOSTED e MEMO.
///   Apenas transações de crédito (TRNAMT > 0) são importadas.
/// </summary>
public sealed class ImportBankStatementUseCase(
    ReceivePixWebhookUseCase webhookUseCase,
    ILogger<ImportBankStatementUseCase> logger)
{
    /// <summary>
    /// Cobranças geradas pelo Recix usam ReferenceId no formato RECIX-yyyyMMdd-nnnnnn.
    /// Valores como RECIX-VENDA-… no extrato costumam estar em Charge.ExternalId — não devem ir para PaymentEvent.ReferenceId.
    /// </summary>
    private static readonly Regex RecixChargeReferenceIdPattern = new(
        @"^RECIX-\d{8}-\d{6}$",
        RegexOptions.CultureInvariant | RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static bool IsRecixChargeReferenceId(string value) =>
        RecixChargeReferenceIdPattern.IsMatch(value.Trim());
    public async Task<ImportStatementResult> ExecuteFromOFXAsync(
        Stream ofxStream,
        CancellationToken ct = default)
    {
        using var reader  = new StreamReader(ofxStream, leaveOpen: true);
        var content       = await reader.ReadToEndAsync(ct);
        var transactions  = OFXParser.ParseTransactions(content);

        var results    = new List<ImportStatementLineResult>();
        int imported   = 0, duplicates = 0, errors = 0;
        int lineNum    = 0;

        foreach (var tx in transactions)
        {
            lineNum++;
            try
            {
                var request = new ReceivePixWebhookRequest
                {
                    EventId    = tx.FitId,
                    PaidAmount = tx.Amount,
                    PaidAt     = tx.PostedAt,
                    Provider   = "OFX",
                    ReferenceId      = null,
                    ExternalChargeId = null,
                };

                var response = await webhookUseCase.ExecuteAsync(request, ct);

                if (response.Status == "IgnoredDuplicate")
                {
                    duplicates++;
                    results.Add(new ImportStatementLineResult { Line = lineNum, EventId = tx.FitId, Status = "Duplicate" });
                }
                else
                {
                    imported++;
                    results.Add(new ImportStatementLineResult { Line = lineNum, EventId = tx.FitId, Status = "Imported" });
                }
            }
            catch (Exception ex)
            {
                errors++;
                logger.LogWarning(ex, "Erro ao importar transação OFX FITID={FitId}", tx.FitId);
                results.Add(new ImportStatementLineResult { Line = lineNum, EventId = tx.FitId, Status = "Error", Error = ex.Message });
            }
        }

        logger.LogInformation("Import OFX concluído: {Imported} importados, {Duplicates} duplicados, {Errors} erros",
            imported, duplicates, errors);

        return new ImportStatementResult { Imported = imported, Duplicates = duplicates, Errors = errors, Lines = results };
    }

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

        // ── Detecta cabeçalho e mapeia colunas por nome ──────────────────────
        // Suporta tanto o formato Recix (eventId,paidAmount,paidAt,...)
        // quanto formatos de extrato bancário (date,description,amount,type,reference,...)
        var header = SplitCsv(lines[0].ToLowerInvariant().Replace(" ", "").Replace("_", ""));

        int Col(params string[] names)
        {
            foreach (var n in names)
            {
                var idx = Array.IndexOf(header, n);
                if (idx >= 0) return idx;
            }
            return -1;
        }

        // Colunas Recix
        var idxEventId    = Col("eventid", "event_id", "fitid", "id", "txid", "transactionid");
        var idxAmount     = Col("paidamount", "paidvalue", "amount", "valor", "trnamt", "value", "credito", "credit");
        var idxDate       = Col("paidat", "date", "datetime", "data", "dtposted", "datahora", "transactiondate");
        var idxType       = Col("type", "trntype", "tipo", "transactiontype");
        var idxReference  = Col("referenceid", "externalchargeid", "reference", "memo", "txid");
        var idxProvider   = Col("provider", "banco", "bank", "institution");
        var idxDescription= Col("description", "descricao", "historico", "memo", "narrative");

        bool hasHeader = idxEventId >= 0 || idxAmount >= 0 || idxDate >= 0;
        int startIndex = hasHeader ? 1 : 0;

        // Se não tem cabeçalho reconhecível, assume formato posicional Recix
        int posEventId = idxEventId >= 0 ? idxEventId : 0;
        int posAmount  = idxAmount  >= 0 ? idxAmount  : 1;
        int posDate    = idxDate    >= 0 ? idxDate    : 2;

        var results  = new List<ImportStatementLineResult>();
        int imported = 0, duplicates = 0, errors = 0;

        for (var i = startIndex; i < lines.Count; i++)
        {
            var raw = lines[i].Trim();
            if (string.IsNullOrEmpty(raw)) continue;

            var lineNum = i + 1;
            var cols    = SplitCsv(raw);

            if (cols.Length <= Math.Max(posEventId, Math.Max(posAmount, posDate)))
            {
                errors++;
                results.Add(new ImportStatementLineResult
                {
                    Line    = lineNum,
                    EventId = cols.Length > 0 ? cols[0] : "",
                    Status  = "Error",
                    Error   = "Linha com colunas insuficientes.",
                });
                continue;
            }

            // Filtra débitos quando coluna de tipo está presente
            if (idxType >= 0 && cols.Length > idxType)
            {
                var tipo = cols[idxType].Trim().ToLowerInvariant();
                if (tipo is "debit" or "debito" or "d" or "db" or "-")
                    continue; // ignora silenciosamente
            }

            var amountRaw = cols[posAmount].Trim();
            var paidAtRaw = cols[posDate].Trim();

            // Gera eventId a partir da referência ou de dados da linha
            string eventId;
            if (posEventId >= 0 && cols.Length > posEventId && !string.IsNullOrWhiteSpace(cols[posEventId]))
            {
                eventId = cols[posEventId].Trim();
            }
            else if (idxReference >= 0 && cols.Length > idxReference && !string.IsNullOrWhiteSpace(cols[idxReference]))
            {
                eventId = $"IMP-{cols[idxReference].Trim()}";
            }
            else
            {
                eventId = $"IMP-{lineNum}-{amountRaw}-{paidAtRaw}";
            }

            if (!decimal.TryParse(amountRaw.Replace(',', '.'), System.Globalization.NumberStyles.Any,
                    System.Globalization.CultureInfo.InvariantCulture, out var paidAmount) || paidAmount <= 0)
            {
                errors++;
                results.Add(new ImportStatementLineResult { Line = lineNum, EventId = eventId, Status = "Error", Error = $"Valor inválido: '{amountRaw}'." });
                continue;
            }

            if (!DateTime.TryParse(paidAtRaw, null, System.Globalization.DateTimeStyles.AssumeLocal, out var paidAt))
            {
                errors++;
                results.Add(new ImportStatementLineResult { Line = lineNum, EventId = eventId, Status = "Error", Error = $"Data inválida: '{paidAtRaw}'." });
                continue;
            }

            // Campos de conciliação — tenta referenceId depois externalChargeId
            var referenceVal = idxReference >= 0 && cols.Length > idxReference
                ? cols[idxReference].Trim() : null;
            string? referenceId      = null;
            string? externalChargeId = null;
            if (!string.IsNullOrWhiteSpace(referenceVal))
            {
                if (IsRecixChargeReferenceId(referenceVal))
                    referenceId = referenceVal.Trim();
                else
                    externalChargeId = referenceVal;
            }

            var descProvider = idxDescription >= 0 && cols.Length > idxDescription
                ? cols[idxDescription].Trim() : null;
            var provider = idxProvider >= 0 && cols.Length > idxProvider && !string.IsNullOrWhiteSpace(cols[idxProvider])
                ? cols[idxProvider].Trim()
                : descProvider ?? "Import";

            try
            {
                var request = new ReceivePixWebhookRequest
                {
                    EventId          = eventId,
                    PaidAmount       = paidAmount,
                    PaidAt           = paidAt.ToUniversalTime(),
                    ReferenceId      = referenceId,
                    ExternalChargeId = externalChargeId,
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
