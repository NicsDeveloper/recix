using FluentAssertions;
using Recix.Domain.Entities;
using Recix.Domain.Enums;

namespace Recix.Tests.Domain;

public sealed class ReconciliationResultTests
{
    private static readonly Guid ChargeId = Guid.NewGuid();
    private static readonly Guid EventId = Guid.NewGuid();

    [Fact]
    public void Create_Matched_HasCorrectFields()
    {
        var result = ReconciliationResult.Create(
            Guid.NewGuid(), ChargeId, EventId, ReconciliationStatus.Matched,
            "Payment matched.", 150m, 150m);

        result.Id.Should().NotBeEmpty();
        result.ChargeId.Should().Be(ChargeId);
        result.PaymentEventId.Should().Be(EventId);
        result.Status.Should().Be(ReconciliationStatus.Matched);
        result.ExpectedAmount.Should().Be(150m);
        result.PaidAmount.Should().Be(150m);
        result.CreatedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(2));
    }

    [Fact]
    public void Create_PaymentWithoutCharge_HasNullChargeId()
    {
        var result = ReconciliationResult.Create(
            Guid.NewGuid(), null, EventId, ReconciliationStatus.PaymentWithoutCharge,
            "No charge found.", null, 100m);

        result.ChargeId.Should().BeNull();
        result.ExpectedAmount.Should().BeNull();
        result.Status.Should().Be(ReconciliationStatus.PaymentWithoutCharge);
    }

    [Fact]
    public void Create_AmountMismatch_StoresCorrectAmounts()
    {
        var result = ReconciliationResult.Create(
            Guid.NewGuid(), ChargeId, EventId, ReconciliationStatus.AmountMismatch,
            "Amount mismatch.", 150.75m, 140m);

        result.ExpectedAmount.Should().Be(150.75m);
        result.PaidAmount.Should().Be(140m);
        result.Status.Should().Be(ReconciliationStatus.AmountMismatch);
    }

    [Theory]
    [InlineData(ReconciliationStatus.DuplicatePayment)]
    [InlineData(ReconciliationStatus.ExpiredChargePaid)]
    [InlineData(ReconciliationStatus.InvalidReference)]
    [InlineData(ReconciliationStatus.ProcessingError)]
    public void Create_AllStatuses_Succeed(ReconciliationStatus status)
    {
        var result = ReconciliationResult.Create(
            Guid.NewGuid(), ChargeId, EventId, status, "Reason.", 100m, 100m);

        result.Status.Should().Be(status);
    }
}
