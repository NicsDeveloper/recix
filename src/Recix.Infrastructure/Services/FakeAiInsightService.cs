using Microsoft.EntityFrameworkCore;
using Recix.Application.Interfaces;
using Recix.Domain.Enums;
using Recix.Infrastructure.Persistence;

namespace Recix.Infrastructure.Services;

public sealed class FakeAiInsightService : IAiInsightService
{
    private const string ModelName = "FakeAiInsightService/1.0";

    private readonly RecixDbContext _db;

    public FakeAiInsightService(RecixDbContext db) => _db = db;

    public async Task<AiExplanationResult> ExplainReconciliationAsync(Guid reconciliationId, CancellationToken cancellationToken = default)
    {
        var result = await _db.ReconciliationResults
            .FirstOrDefaultAsync(r => r.Id == reconciliationId, cancellationToken)
            ?? throw new KeyNotFoundException($"Reconciliation {reconciliationId} not found.");

        var explanation = result.Status switch
        {
            ReconciliationStatus.Matched =>
                $"O pagamento foi conciliado com sucesso. O valor recebido de R$ {result.PaidAmount:F2} corresponde exatamente ao valor cobrado.",

            ReconciliationStatus.AmountMismatch =>
                $"Este pagamento foi marcado como divergente porque o valor recebido foi R$ {result.PaidAmount:F2}, " +
                $"mas a cobrança esperava R$ {result.ExpectedAmount:F2}. " +
                $"A diferença de R$ {Math.Abs(result.PaidAmount - result.ExpectedAmount!.Value):F2} indica possível erro no valor enviado pelo pagador.",

            ReconciliationStatus.DuplicatePayment =>
                $"Este evento representa um pagamento duplicado. A cobrança associada já havia sido paga anteriormente. " +
                $"O valor de R$ {result.PaidAmount:F2} não foi processado novamente para evitar dupla cobrança.",

            ReconciliationStatus.PaymentWithoutCharge =>
                $"Nenhuma cobrança foi encontrada para este pagamento de R$ {result.PaidAmount:F2}. " +
                $"O evento foi registrado para auditoria, mas nenhuma conciliação pôde ser realizada. " +
                $"Verifique se o identificador de cobrança está correto.",

            ReconciliationStatus.ExpiredChargePaid =>
                $"A cobrança estava expirada no momento em que o pagamento de R$ {result.PaidAmount:F2} foi recebido. " +
                $"O pagamento foi registrado como divergente. Entre em contato com o pagador para regularização.",

            ReconciliationStatus.InvalidReference =>
                $"O evento de pagamento não continha identificadores válidos para localizar a cobrança. " +
                $"O valor de R$ {result.PaidAmount:F2} não pôde ser conciliado. Verifique o payload original do webhook.",

            ReconciliationStatus.ProcessingError =>
                $"Ocorreu um erro durante o processamento deste evento de pagamento de R$ {result.PaidAmount:F2}. " +
                $"O evento foi marcado como falha. Verifique os logs do sistema para mais detalhes.",

            _ => $"Status de conciliação desconhecido: {result.Status}."
        };

        return new AiExplanationResult
        {
            ReconciliationId = reconciliationId,
            Explanation = explanation,
            GeneratedAt = DateTime.UtcNow,
            Model = ModelName
        };
    }

    public async Task<AiSummaryResult> GenerateDailySummaryAsync(DateTime date, CancellationToken cancellationToken = default)
    {
        var start = date.Date.ToUniversalTime();
        var end = start.AddDays(1);

        var charges = await _db.Charges
            .Where(c => c.CreatedAt >= start && c.CreatedAt < end)
            .ToListAsync(cancellationToken);

        var reconciliations = await _db.ReconciliationResults
            .Where(r => r.CreatedAt >= start && r.CreatedAt < end)
            .ToListAsync(cancellationToken);

        var total = charges.Count;
        var paid = charges.Count(c => c.Status == ChargeStatus.Paid);
        var pending = charges.Count(c => c.Status == ChargeStatus.Pending);
        var divergent = charges.Count(c => c.Status == ChargeStatus.Divergent);
        var expired = charges.Count(c => c.Status == ChargeStatus.Expired);
        var totalAmount = charges.Where(c => c.Status == ChargeStatus.Paid).Sum(c => c.Amount);
        var duplicates = reconciliations.Count(r => r.Status == ReconciliationStatus.DuplicatePayment);
        var mismatches = reconciliations.Count(r => r.Status == ReconciliationStatus.AmountMismatch);
        var withoutCharge = reconciliations.Count(r => r.Status == ReconciliationStatus.PaymentWithoutCharge);

        var parts = new List<string>
        {
            $"Em {date:dd/MM/yyyy}, foram criadas {total} cobrança(s) totalizando R$ {charges.Sum(c => c.Amount):F2}."
        };

        if (paid > 0)
            parts.Add($"Desse total, {paid} foram pagas com sucesso, totalizando R$ {totalAmount:F2} recebidos.");

        if (divergent > 0)
            parts.Add($"{divergent} cobrança(s) apresentaram divergência.");

        if (expired > 0)
            parts.Add($"{expired} cobrança(s) expiraram sem pagamento.");

        if (pending > 0)
            parts.Add($"{pending} cobrança(s) ainda estão pendentes.");

        if (duplicates > 0)
            parts.Add($"Foram detectados {duplicates} pagamento(s) duplicado(s).");

        if (mismatches > 0)
            parts.Add($"{mismatches} pagamento(s) com valor divergente do cobrado.");

        if (withoutCharge > 0)
            parts.Add($"{withoutCharge} pagamento(s) recebido(s) sem cobrança correspondente.");

        if (total == 0)
            parts.Add("Nenhuma cobrança foi criada neste dia.");

        return new AiSummaryResult
        {
            Date = date.ToString("yyyy-MM-dd"),
            Summary = string.Join(" ", parts),
            GeneratedAt = DateTime.UtcNow,
            Model = ModelName
        };
    }
}
