using Recix.Application.Services;
using Recix.Domain.Entities;
using Recix.Domain.Enums;

namespace Recix.Tests.Application;

public sealed class ReconciliationAggregateClassifierTests
{
    [Fact]
    public void Two_partial_payments_sum_to_matched_aggregate()
    {
        var org = Guid.NewGuid();
        var chargeId = Guid.NewGuid();
        var pe1 = Guid.NewGuid();
        var pe2 = Guid.NewGuid();

        var r1 = ReconciliationResult.Create(org, chargeId, pe1, ReconciliationStatus.PartialPayment, "p1",
            500, 250, ConfidenceLevel.High, MatchReason.ExactReferenceId, "ReferenceId");
        var r2 = ReconciliationResult.Create(org, chargeId, pe2, ReconciliationStatus.Matched, "ok",
            500, 250, ConfidenceLevel.High, MatchReason.ExactReferenceId, "ReferenceId");

        var rows = new[] { r1, r2 };
        var label = ReconciliationAggregateClassifier.Classify(500, rows);
        Assert.Equal("Conciliado", label);
        Assert.Equal(500, ReconciliationAggregateClassifier.SumAllocatedTowardCharge(rows));
        Assert.Equal(500, ReconciliationAggregateClassifier.SumAllocatedTowardCharge(rows, recognizedFromAllocations: 500));
    }

    [Fact]
    public void Allocation_sum_takes_precedence_over_legacy_rows()
    {
        var org      = Guid.NewGuid();
        var chargeId = Guid.NewGuid();
        var pe       = Guid.NewGuid();
        var r        = ReconciliationResult.Create(org, chargeId, pe, ReconciliationStatus.PartialPayment, "p1",
            500, 250, ConfidenceLevel.High, MatchReason.ExactReferenceId, "ReferenceId");

        Assert.Equal(400, ReconciliationAggregateClassifier.SumAllocatedTowardCharge([r], recognizedFromAllocations: 400));
    }

    [Fact]
    public void Single_partial_is_partial_aggregate()
    {
        var org = Guid.NewGuid();
        var chargeId = Guid.NewGuid();
        var pe = Guid.NewGuid();
        var r = ReconciliationResult.Create(org, chargeId, pe, ReconciliationStatus.PartialPayment, "parcial",
            500, 250, ConfidenceLevel.High, MatchReason.ExactReferenceId, "ReferenceId");

        var label = ReconciliationAggregateClassifier.Classify(500, [r]);
        Assert.Equal("Parcial", label);
    }
}
