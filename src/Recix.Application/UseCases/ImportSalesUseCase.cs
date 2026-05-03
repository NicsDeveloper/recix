using System.Globalization;
using Microsoft.Extensions.Logging;
using Recix.Application.DTOs;
using Recix.Application.Interfaces;
using Recix.Domain.Entities;
using Recix.Domain.Enums;

namespace Recix.Application.UseCases;

/// <summary>
/// Importa vendas a partir de um CSV simples e cria cobranças para cada linha.
/// Isso permite reconciliar extratos bancários sem alterar o fluxo do caixa.
///
/// Formatos aceitos (cabeçalho obrigatório, ordem das colunas não importa):
///   valor,descricao[,data]
///   data,valor,descricao
///
/// Colunas:
///   valor*       — valor decimal (ex: 350.00 ou 350,00)
///   descricao*   — descrição da venda (ex: Amortecedor dianteiro)
///   data         — data/hora da venda ISO ou dd/MM/yyyy HH:mm (default: agora)
///
/// A cobrança expira em 48h após a data da venda (SLA), nunca antes de ~1 minuto no futuro (requisito do domínio).
/// Após importar, re-concilia payment events órfãos (PaymentWithoutCharge).
/// </summary>
public sealed class ImportSalesUseCase(
    IChargeRepository charges,
    IReconciliationRepository reconciliations,
    IPaymentEventRepository paymentEvents,
    ICurrentOrganization currentOrg,
    ILogger<ImportSalesUseCase> logger)
{
    private static readonly string[] DateFormats =
    [
        "yyyy-MM-ddTHH:mm:ssZ",
        "yyyy-MM-ddTHH:mm:ss",
        "yyyy-MM-dd HH:mm:ss",
        "yyyy-MM-dd HH:mm",
        "yyyy-MM-dd",
        "dd/MM/yyyy HH:mm:ss",
        "dd/MM/yyyy HH:mm",
        "dd/MM/yyyy",
    ];

    public async Task<ImportSalesResult> ExecuteAsync(Stream csvStream, CancellationToken ct = default)
    {
        var orgId = currentOrg.OrganizationId
            ?? throw new UnauthorizedAccessException("Contexto de organização não disponível.");

        using var reader = new StreamReader(csvStream, leaveOpen: true);
        var lines        = new List<string>();
        while (await reader.ReadLineAsync(ct) is { } line)
            lines.Add(line);

        if (lines.Count == 0)
            return new ImportSalesResult();

        // Detecta índice de cada coluna a partir do cabeçalho
        if (lines.Count < 2)
            return new ImportSalesResult { Errors = 1, Lines = [new ImportSalesLineResult { Line = 1, Status = "Error", Error = "Arquivo deve ter cabeçalho e ao menos uma linha de dados." }] };

        var header       = SplitCsv(lines[0].ToLowerInvariant());
        var idxValor     = FindColumn(header, "valor", "amount", "value");
        var idxDescricao = FindColumn(header, "descricao", "descrição", "description", "memo", "item");
        var idxData      = FindColumn(header, "data", "date", "datetime", "data_hora");
        var idxReference = FindColumn(header, "reference", "referencia", "referência", "externalid", "txid", "id");

        if (idxValor < 0 || idxDescricao < 0)
            return new ImportSalesResult
            {
                Errors = 1,
                Lines  = [new ImportSalesLineResult { Line = 1, Status = "Error", Error = "Cabeçalho deve conter colunas 'valor' e 'descricao'." }],
            };

        var results  = new List<ImportSalesLineResult>();
        int created  = 0, skipped = 0, errors = 0;

        for (var i = 1; i < lines.Count; i++)
        {
            var raw = lines[i].Trim();
            if (string.IsNullOrEmpty(raw)) continue;

            var lineNum = i + 1;
            var cols    = SplitCsv(raw);

            // Valor
            var amountRaw = cols.Length > idxValor ? cols[idxValor].Trim() : "";
            if (!decimal.TryParse(amountRaw.Replace(',', '.'), NumberStyles.Any,
                    CultureInfo.InvariantCulture, out var amount) || amount <= 0)
            {
                errors++;
                results.Add(new ImportSalesLineResult { Line = lineNum, Status = "Error", Error = $"Valor inválido: '{amountRaw}'." });
                continue;
            }

            // Descrição
            var description = cols.Length > idxDescricao ? cols[idxDescricao].Trim() : "";
            if (string.IsNullOrWhiteSpace(description))
            {
                errors++;
                results.Add(new ImportSalesLineResult { Line = lineNum, Amount = amount, Status = "Error", Error = "Descrição não pode ser vazia." });
                continue;
            }

            // Data (opcional)
            DateTime saleDate;
            if (idxData >= 0 && cols.Length > idxData && !string.IsNullOrWhiteSpace(cols[idxData]))
            {
                var dateRaw = cols[idxData].Trim();
                if (!TryParseDate(dateRaw, out saleDate))
                {
                    errors++;
                    results.Add(new ImportSalesLineResult { Line = lineNum, Amount = amount, Description = description, Status = "Error", Error = $"Data inválida: '{dateRaw}'." });
                    continue;
                }
            }
            else
            {
                saleDate = DateTime.UtcNow;
            }

            const int importPaymentSlaHours = 48;
            var saleUtc     = saleDate.Kind == DateTimeKind.Unspecified
                ? DateTime.SpecifyKind(saleDate, DateTimeKind.Utc)
                : saleDate.ToUniversalTime();
            var expiresFromSale = saleUtc.AddHours(importPaymentSlaHours);
            var minFuture       = DateTime.UtcNow.AddMinutes(1);
            var expiresAt       = expiresFromSale > minFuture ? expiresFromSale : minFuture;
            var referenceId = await GenerateReferenceIdAsync(ct);

            // Usa a coluna reference como ExternalId para permitir cruzamento com extrato bancário
            var externalId  = idxReference >= 0 && cols.Length > idxReference && !string.IsNullOrWhiteSpace(cols[idxReference])
                ? cols[idxReference].Trim()
                : referenceId;

            try
            {
                var charge = Charge.Create(orgId, referenceId, externalId, amount, expiresAt);
                await charges.AddAsync(charge, ct);

                created++;
                results.Add(new ImportSalesLineResult
                {
                    Line        = lineNum,
                    Amount      = amount,
                    Description = description,
                    Status      = "Created",
                    ReferenceId = referenceId,
                });

                logger.LogInformation("Venda importada: ReferenceId={ReferenceId} Amount={Amount} Description={Description} SaleDate={SaleDate}",
                    referenceId, amount, description, saleDate);
            }
            catch (Exception ex)
            {
                errors++;
                logger.LogWarning(ex, "Erro ao criar cobrança para linha {Line}", lineNum);
                results.Add(new ImportSalesLineResult { Line = lineNum, Amount = amount, Description = description, Status = "Error", Error = ex.Message });
            }
        }

        logger.LogInformation("Import de vendas concluído: {Created} criadas, {Skipped} ignoradas, {Errors} erros",
            created, skipped, errors);

        if (created > 0)
            await RequeueOrphanPaymentEventsAsync(orgId, ct);

        return new ImportSalesResult { Created = created, Skipped = skipped, Errors = errors, Lines = results };
    }

    private async Task RequeueOrphanPaymentEventsAsync(Guid orgId, CancellationToken ct)
    {
        // Reprocessa pagamentos sem cobrança E pagamentos com valor divergente —
        // o novo import de vendas pode ter trazido a cobrança correta para eles.
        var orphans = await reconciliations.GetByStatusAndOrganizationAsync(
            ReconciliationStatus.PaymentWithoutCharge, orgId, ct);

        var mismatches = await reconciliations.GetByStatusAndOrganizationAsync(
            ReconciliationStatus.AmountMismatch, orgId, ct);

        var candidates = orphans.Concat(mismatches).ToList();
        if (candidates.Count == 0) return;

        logger.LogInformation("Re-conciliando {Count} payment event(s) candidato(s) após import de vendas.", candidates.Count);

        foreach (var candidate in candidates)
        {
            try
            {
                var evt = await paymentEvents.GetByIdAsync(candidate.PaymentEventId, ct);
                if (evt is null || evt.Status != PaymentEventStatus.Processed) continue;

                await reconciliations.DeleteAsync(candidate.Id, ct);
                evt.RequeueForReReconciliation();
                await paymentEvents.UpdateAsync(evt, ct);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Falha ao reenfileirar PaymentEvent {PaymentEventId} para re-conciliação.",
                    candidate.PaymentEventId);
            }
        }
    }

    private async Task<string> GenerateReferenceIdAsync(CancellationToken ct)
    {
        var today = DateTime.UtcNow.Date;
        var count = await charges.CountByDateAsync(today, ct);
        return $"RECIX-{today:yyyyMMdd}-{count + 1:D6}";
    }

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
        if (DateTime.TryParseExact(raw, DateFormats, CultureInfo.InvariantCulture,
                DateTimeStyles.AssumeLocal | DateTimeStyles.AllowWhiteSpaces, out result))
        {
            result = result.ToUniversalTime();
            return true;
        }
        if (DateTime.TryParse(raw, CultureInfo.InvariantCulture, DateTimeStyles.AssumeLocal, out result))
        {
            result = result.ToUniversalTime();
            return true;
        }
        return false;
    }

    private static string[] SplitCsv(string line)
    {
        var fields  = new List<string>();
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
        return [.. fields];
    }
}
