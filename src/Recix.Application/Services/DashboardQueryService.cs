using Recix.Application.DTOs;
using Recix.Application.Interfaces;
using Recix.Domain.Enums;

namespace Recix.Application.Services;

public sealed class DashboardQueryService
{
    private readonly IChargeRepository _charges;
    private readonly IReconciliationRepository _reconciliations;

    public DashboardQueryService(IChargeRepository charges, IReconciliationRepository reconciliations)
    {
        _charges = charges;
        _reconciliations = reconciliations;
    }

    public async Task<DashboardSummaryDto> GetSummaryAsync(CancellationToken cancellationToken = default)
    {
        var chargesPage = await _charges.ListAsync(null, null, null, 1, int.MaxValue, cancellationToken);
        var reconciliationsPage = await _reconciliations.ListAsync(null, null, null, 1, int.MaxValue, cancellationToken);

        var charges = chargesPage.Items;
        var reconciliations = reconciliationsPage.Items;

        return new DashboardSummaryDto
        {
            TotalCharges = charges.Count,
            PaidCharges = charges.Count(c => c.Status == ChargeStatus.Paid),
            PendingCharges = charges.Count(c => c.Status == ChargeStatus.Pending),
            DivergentCharges = charges.Count(c => c.Status == ChargeStatus.Divergent),
            ExpiredCharges = charges.Count(c => c.Status == ChargeStatus.Expired),
            TotalReceivedAmount = charges
                .Where(c => c.Status == ChargeStatus.Paid)
                .Sum(c => c.Amount),
            TotalDivergentAmount = charges
                .Where(c => c.Status == ChargeStatus.Divergent)
                .Sum(c => c.Amount),
            ReconciliationIssues = new ReconciliationIssuesDto
            {
                AmountMismatch = reconciliations.Count(r => r.Status == ReconciliationStatus.AmountMismatch),
                DuplicatePayment = reconciliations.Count(r => r.Status == ReconciliationStatus.DuplicatePayment),
                PaymentWithoutCharge = reconciliations.Count(r => r.Status == ReconciliationStatus.PaymentWithoutCharge),
                ExpiredChargePaid = reconciliations.Count(r => r.Status == ReconciliationStatus.ExpiredChargePaid),
                InvalidReference = reconciliations.Count(r => r.Status == ReconciliationStatus.InvalidReference),
                ProcessingError = reconciliations.Count(r => r.Status == ReconciliationStatus.ProcessingError)
            }
        };
    }
}
