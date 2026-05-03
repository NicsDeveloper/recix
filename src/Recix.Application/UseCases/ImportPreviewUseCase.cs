using System.Globalization;
using Recix.Application.DTOs;
using Recix.Application.Interfaces;
using Recix.Application.Services;

namespace Recix.Application.UseCases;

/// <summary>
/// Faz parse e validação de um arquivo de importação SEM persistir nada.
/// Retorna um preview estruturado que o frontend exibe para confirmação do usuário.
/// Após aprovação, a importação real é feita pelos use cases existentes.
/// </summary>
public sealed class ImportPreviewUseCase(IChargeRepository charges)
{
    // ── Vendas (CSV) ──────────────────────────────────────────────────────────────

    public async Task<ImportPreviewResult> PreviewSalesAsync(Stream csvStream, string fileName, CancellationToken ct = default)
    {
        using var reader = new StreamReader(csvStream, leaveOpen: true);
        var lines        = new List<string>();
        while (await reader.ReadLineAsync(ct) is { } line)
            lines.Add(line);

        if (lines.Count == 0)
            return EmptyResult(ImportType.Sales, fileName);

        var header     = SplitCsv(lines[0].ToLowerInvariant());
        var idxValor     = FindColumn(header, "valor", "amount", "value");
        var idxDescr     = FindColumn(header, "descricao", "descrição", "description", "memo", "item");
        var idxData      = FindColumn(header, "data", "date", "datetime", "data_hora");
        var idxReference = FindColumn(header, "reference", "referencia", "referência", "externalid", "txid", "id");

        var detected = new List<string>();
        if (idxValor >= 0)     detected.Add("valor");
        if (idxDescr >= 0)   detected.Add("descricao");
        if (idxData  >= 0)   detected.Add("data");
        if (idxReference >= 0) detected.Add("referencia");

        if (idxValor < 0 || idxDescr < 0)
        {
            return new ImportPreviewResult
            {
                Type       = ImportType.Sales,
                FileName   = fileName,
                TotalLines = lines.Count - 1,
                ErrorLines = lines.Count - 1,
                Lines =
                [
                    new ImportPreviewLine
                    {
                        LineNumber = 1,
                        Status     = LineValidationStatus.Error,
                        Message    = "Cabeçalho inválido — colunas 'valor' e 'descricao' são obrigatórias.",
                    }
                ],
            };
        }

        var result  = new List<ImportPreviewLine>();
        int ok = 0, warn = 0, err = 0;

        var today        = DateTime.UtcNow.Date;
        var baseRefCount = await charges.CountByDateAsync(today, ct);
        var salesSeq     = 0;

        for (var i = 1; i < lines.Count; i++)
        {
            var raw = lines[i].Trim();
            if (string.IsNullOrEmpty(raw)) continue;

            var lineNum = i + 1;
            var cols    = SplitCsv(raw);

            var amountRaw = cols.Length > idxValor ? cols[idxValor].Trim() : "";
            var descr     = cols.Length > idxDescr ? cols[idxDescr].Trim() : "";
            var dateRaw   = idxData >= 0 && cols.Length > idxData ? cols[idxData].Trim() : "";
            var refRaw    = idxReference >= 0 && cols.Length > idxReference ? cols[idxReference].Trim() : "";

            if (!decimal.TryParse(amountRaw.Replace(',', '.'), NumberStyles.Any, CultureInfo.InvariantCulture, out var amount) || amount < 0)
            {
                err++;
                result.Add(new ImportPreviewLine { LineNumber = lineNum, Status = LineValidationStatus.Error,
                    Message = $"Valor inválido: '{amountRaw}'.", Amount = null, Description = descr, Date = dateRaw });
                continue;
            }

            if (amount == 0)
            {
                warn++;
                result.Add(new ImportPreviewLine { LineNumber = lineNum, Status = LineValidationStatus.Warning,
                    Message = "Valor R$ 0,00 — será ignorada na importação.", Amount = amount, Description = descr, Date = dateRaw });
                continue;
            }

            if (string.IsNullOrWhiteSpace(descr))
            {
                err++;
                result.Add(new ImportPreviewLine { LineNumber = lineNum, Status = LineValidationStatus.Error,
                    Message = "Descrição vazia.", Amount = amount, Description = null, Date = dateRaw });
                continue;
            }

            if (!string.IsNullOrWhiteSpace(dateRaw) && !TryParseDate(dateRaw, out _))
            {
                err++;
                result.Add(new ImportPreviewLine { LineNumber = lineNum, Status = LineValidationStatus.Error,
                    Message = $"Data inválida: '{dateRaw}'.", Amount = amount, Description = descr, Date = dateRaw });
                continue;
            }

            ok++;
            salesSeq++;
            var referencePreview = $"RECIX-{today:yyyyMMdd}-{(baseRefCount + salesSeq):D6}";
            result.Add(new ImportPreviewLine
            {
                LineNumber  = lineNum,
                Status      = LineValidationStatus.Ok,
                Amount      = amount,
                Description = descr,
                Date        = string.IsNullOrEmpty(dateRaw) ? "agora" : dateRaw,
                Reference   = referencePreview,
                EventId     = string.IsNullOrWhiteSpace(refRaw) ? null : refRaw,
            });
        }

        return new ImportPreviewResult
        {
            Type             = ImportType.Sales,
            FileName         = fileName,
            TotalLines       = ok + warn + err,
            ValidLines       = ok,
            WarningLines     = warn,
            ErrorLines       = err,
            DetectedColumns  = detected,
            Lines            = result,
        };
    }

    // ── Extrato bancário (CSV ou OFX) ─────────────────────────────────────────────

    public async Task<ImportPreviewResult> PreviewStatementAsync(
        Stream stream, string fileName, bool isOfx, CancellationToken ct = default)
    {
        if (isOfx)
            return await PreviewOfxAsync(stream, fileName, ct);

        return await PreviewStatementCsvAsync(stream, fileName, ct);
    }

    private static async Task<ImportPreviewResult> PreviewOfxAsync(
        Stream stream, string fileName, CancellationToken ct)
    {
        using var reader = new StreamReader(stream, leaveOpen: true);
        var content      = await reader.ReadToEndAsync(ct);
        var transactions = OFXParser.ParseTransactions(content);

        var lines = new List<ImportPreviewLine>();
        int ok = 0, warn = 0, err = 0;

        for (var i = 0; i < transactions.Count; i++)
        {
            var tx  = transactions[i];
            var num = i + 1;

            if (tx.Amount <= 0)
            {
                // débitos são filtrados silenciosamente — mostrar como warning
                warn++;
                lines.Add(new ImportPreviewLine
                {
                    LineNumber  = num,
                    Status      = LineValidationStatus.Warning,
                    Message     = "Débito — será ignorado (somente créditos são importados).",
                    EventId     = tx.FitId,
                    Amount      = tx.Amount,
                    Date        = tx.PostedAt.ToString("dd/MM/yyyy HH:mm"),
                    Provider    = "OFX",
                });
                continue;
            }

            ok++;
            lines.Add(new ImportPreviewLine
            {
                LineNumber = num,
                Status     = LineValidationStatus.Ok,
                EventId    = tx.FitId,
                Amount     = tx.Amount,
                Date       = tx.PostedAt.ToString("dd/MM/yyyy HH:mm"),
                Provider   = "OFX",
            });
        }

        return new ImportPreviewResult
        {
            Type         = ImportType.BankStatement,
            FileName     = fileName,
            TotalLines   = ok + warn + err,
            ValidLines   = ok,
            WarningLines = warn,
            ErrorLines   = err,
            DetectedColumns = ["fitId", "amount", "date"],
            Lines        = lines,
        };
    }

    private async Task<ImportPreviewResult> PreviewStatementCsvAsync(
        Stream stream, string fileName, CancellationToken ct)
    {
        using var reader = new StreamReader(stream, leaveOpen: true);
        var rawLines     = new List<string>();
        while (await reader.ReadLineAsync(ct) is { } line)
            rawLines.Add(line);

        if (rawLines.Count == 0)
            return EmptyResult(ImportType.BankStatement, fileName);

        var header       = SplitCsv(rawLines[0].ToLowerInvariant().Replace(" ", "").Replace("_", ""));
        int IdxOf(params string[] names) { foreach (var n in names) { var i = Array.IndexOf(header, n); if (i >= 0) return i; } return -1; }

        var idxId    = IdxOf("eventid", "event_id", "fitid", "id", "txid");
        var idxAmt   = IdxOf("paidamount", "amount", "valor", "trnamt", "credito");
        var idxDate  = IdxOf("paidat", "date", "data", "dtposted");
        var idxType  = IdxOf("type", "trntype", "tipo");
        var idxRef   = IdxOf("referenceid", "reference", "memo", "txid");

        var detected = new List<string>();
        if (idxId   >= 0) detected.Add(header[idxId]);
        if (idxAmt  >= 0) detected.Add(header[idxAmt]);
        if (idxDate >= 0) detected.Add(header[idxDate]);

        var existingIds = new HashSet<string>();
        var lines = new List<ImportPreviewLine>();
        int ok = 0, warn = 0, err = 0;

        for (var i = 1; i < rawLines.Count; i++)
        {
            var raw = rawLines[i].Trim();
            if (string.IsNullOrEmpty(raw)) continue;

            var lineNum = i + 1;
            var cols    = SplitCsv(raw);

            // Filtrar débitos
            if (idxType >= 0 && cols.Length > idxType)
            {
                var tipo = cols[idxType].Trim().ToLowerInvariant();
                if (tipo is "debit" or "debito" or "d" or "db" or "-")
                {
                    warn++;
                    lines.Add(new ImportPreviewLine
                    {
                        LineNumber = lineNum,
                        Status     = LineValidationStatus.Warning,
                        Message    = "Débito — será ignorado.",
                    });
                    continue;
                }
            }

            var amtRaw = idxAmt >= 0 && cols.Length > idxAmt ? cols[idxAmt].Trim() : "";
            var dtRaw  = idxDate >= 0 && cols.Length > idxDate ? cols[idxDate].Trim() : "";
            var evtId  = idxId >= 0 && cols.Length > idxId ? cols[idxId].Trim() : $"IMP-{lineNum}";
            var refVal = idxRef >= 0 && cols.Length > idxRef ? cols[idxRef].Trim() : null;

            if (!decimal.TryParse(amtRaw.Replace(',', '.'), NumberStyles.Any, CultureInfo.InvariantCulture, out var amount) || amount <= 0)
            {
                err++;
                lines.Add(new ImportPreviewLine { LineNumber = lineNum, Status = LineValidationStatus.Error,
                    Message = $"Valor inválido: '{amtRaw}'.", EventId = evtId });
                continue;
            }

            if (!DateTime.TryParse(dtRaw, null, DateTimeStyles.AssumeLocal, out var date))
            {
                err++;
                lines.Add(new ImportPreviewLine { LineNumber = lineNum, Status = LineValidationStatus.Error,
                    Message = $"Data inválida: '{dtRaw}'.", EventId = evtId, Amount = amount });
                continue;
            }

            // Detectar duplicata no próprio arquivo
            if (!existingIds.Add(evtId))
            {
                warn++;
                lines.Add(new ImportPreviewLine
                {
                    LineNumber = lineNum,
                    Status     = LineValidationStatus.Warning,
                    Message    = $"ID '{evtId}' já aparece no arquivo — será ignorada (duplicata).",
                    EventId    = evtId, Amount = amount, Date = dtRaw,
                });
                continue;
            }

            ok++;
            lines.Add(new ImportPreviewLine
            {
                LineNumber  = lineNum,
                Status      = LineValidationStatus.Ok,
                EventId     = evtId,
                Amount      = amount,
                Date        = date.ToString("dd/MM/yyyy HH:mm"),
                Reference   = refVal,
            });
        }

        return new ImportPreviewResult
        {
            Type             = ImportType.BankStatement,
            FileName         = fileName,
            TotalLines       = ok + warn + err,
            ValidLines       = ok,
            WarningLines     = warn,
            ErrorLines       = err,
            DetectedColumns  = detected,
            Lines            = lines,
        };
    }

    // ── Helpers ───────────────────────────────────────────────────────────────────

    private static ImportPreviewResult EmptyResult(ImportType type, string fileName) =>
        new() { Type = type, FileName = fileName };

    private static int FindColumn(string[] header, params string[] candidates)
    {
        foreach (var c in candidates)
        {
            var idx = Array.IndexOf(header, c);
            if (idx >= 0) return idx;
        }
        return -1;
    }

    private static bool TryParseDate(string raw, out DateTime result)
    {
        if (DateTime.TryParseExact(raw,
            ["yyyy-MM-ddTHH:mm:ssZ", "yyyy-MM-ddTHH:mm:ss", "yyyy-MM-dd HH:mm:ss", "yyyy-MM-dd HH:mm",
             "yyyy-MM-dd", "dd/MM/yyyy HH:mm:ss", "dd/MM/yyyy HH:mm", "dd/MM/yyyy"],
            CultureInfo.InvariantCulture,
            DateTimeStyles.AssumeLocal | DateTimeStyles.AllowWhiteSpaces,
            out result))
            return true;

        return DateTime.TryParse(raw, CultureInfo.InvariantCulture, DateTimeStyles.AssumeLocal, out result);
    }

    private static string[] SplitCsv(string line)
    {
        var fields   = new List<string>();
        var current  = new System.Text.StringBuilder();
        var inQuotes = false;
        for (var i = 0; i < line.Length; i++)
        {
            var ch = line[i];
            if (ch == '"') { if (inQuotes && i + 1 < line.Length && line[i + 1] == '"') { current.Append('"'); i++; } else inQuotes = !inQuotes; }
            else if (ch == ',' && !inQuotes) { fields.Add(current.ToString()); current.Clear(); }
            else current.Append(ch);
        }
        fields.Add(current.ToString());
        return [.. fields];
    }
}
