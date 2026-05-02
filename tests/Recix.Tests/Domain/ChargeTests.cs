using FluentAssertions;
using Recix.Domain.Entities;
using Recix.Domain.Enums;
using Recix.Domain.Exceptions;

namespace Recix.Tests.Domain;

public sealed class ChargeTests
{
    private static DateTime FutureExpiry => DateTime.UtcNow.AddMinutes(30);
    private static DateTime PastExpiry => DateTime.UtcNow.AddMinutes(-1);

    // --- Create invariants ---

    [Fact]
    public void Create_WithZeroAmount_ThrowsDomainException()
    {
        var act = () => Charge.Create(Guid.NewGuid(), "REF-001", "ext-001", 0m, FutureExpiry);
        act.Should().Throw<DomainException>().WithMessage("*greater than zero*");
    }

    [Fact]
    public void Create_WithNegativeAmount_ThrowsDomainException()
    {
        var act = () => Charge.Create(Guid.NewGuid(), "REF-001", "ext-001", -10m, FutureExpiry);
        act.Should().Throw<DomainException>().WithMessage("*greater than zero*");
    }

    [Fact]
    public void Create_WithPastExpiry_ThrowsDomainException()
    {
        var act = () => Charge.Create(Guid.NewGuid(), "REF-001", "ext-001", 100m, PastExpiry);
        act.Should().Throw<DomainException>().WithMessage("*future*");
    }

    [Fact]
    public void Create_WithValidData_ReturnsPendingCharge()
    {
        var charge = Charge.Create(Guid.NewGuid(), "REF-001", "ext-001", 150.75m, FutureExpiry);

        charge.Id.Should().NotBeEmpty();
        charge.ReferenceId.Should().Be("REF-001");
        charge.ExternalId.Should().Be("ext-001");
        charge.Amount.Should().Be(150.75m);
        charge.Status.Should().Be(ChargeStatus.Pending);
        charge.UpdatedAt.Should().BeNull();
    }

    // --- IsExpired ---

    [Fact]
    public void IsExpired_WhenExpiryInFuture_ReturnsFalse()
    {
        var charge = Charge.Create(Guid.NewGuid(), "REF-001", "ext-001", 100m, FutureExpiry);
        charge.IsExpired().Should().BeFalse();
    }

    [Fact]
    public void IsExpired_WhenExpiryInPast_ReturnsTrue()
    {
        // Use reflection to create an expired charge (bypasses invariant)
        var charge = CreateExpiredCharge();
        charge.IsExpired().Should().BeTrue();
    }

    // --- MarkAsPaid ---

    [Fact]
    public void MarkAsPaid_WhenPending_TransitionsToPaid()
    {
        var charge = Charge.Create(Guid.NewGuid(), "REF-001", "ext-001", 100m, FutureExpiry);

        charge.MarkAsPaid();

        charge.Status.Should().Be(ChargeStatus.Paid);
        charge.UpdatedAt.Should().NotBeNull();
    }

    [Fact]
    public void MarkAsPaid_WhenAlreadyPaid_ThrowsDomainException()
    {
        var charge = Charge.Create(Guid.NewGuid(), "REF-001", "ext-001", 100m, FutureExpiry);
        charge.MarkAsPaid();

        var act = () => charge.MarkAsPaid();

        act.Should().Throw<DomainException>().WithMessage("*Paid*");
    }

    [Fact]
    public void MarkAsPaid_WhenDivergent_Succeeds()
    {
        // Divergent → Paid é permitido para suportar re-conciliação:
        // quando um pagamento com valor correto chega para uma cobrança que estava Divergent.
        var charge = Charge.Create(Guid.NewGuid(), "REF-001", "ext-001", 100m, FutureExpiry);
        charge.MarkAsDivergent();

        var act = () => charge.MarkAsPaid();

        act.Should().NotThrow();
        charge.Status.Should().Be(ChargeStatus.Paid);
    }

    [Fact]
    public void MarkAsPaid_WhenExpired_ThrowsDomainException()
    {
        var charge = Charge.Create(Guid.NewGuid(), "REF-001", "ext-001", 100m, FutureExpiry);
        charge.MarkAsExpired();

        var act = () => charge.MarkAsPaid();

        act.Should().Throw<DomainException>();
    }

    // --- MarkAsDivergent ---

    [Fact]
    public void MarkAsDivergent_WhenPending_TransitionsToDivergent()
    {
        var charge = Charge.Create(Guid.NewGuid(), "REF-001", "ext-001", 100m, FutureExpiry);

        charge.MarkAsDivergent();

        charge.Status.Should().Be(ChargeStatus.Divergent);
    }

    [Fact]
    public void MarkAsDivergent_WhenExpired_TransitionsToDivergent()
    {
        var charge = CreateExpiredCharge();
        charge.MarkAsExpired();

        charge.MarkAsDivergent();

        charge.Status.Should().Be(ChargeStatus.Divergent);
    }

    [Fact]
    public void MarkAsDivergent_WhenPaid_ThrowsDomainException()
    {
        var charge = Charge.Create(Guid.NewGuid(), "REF-001", "ext-001", 100m, FutureExpiry);
        charge.MarkAsPaid();

        var act = () => charge.MarkAsDivergent();

        act.Should().Throw<DomainException>();
    }

    [Fact]
    public void MarkAsDivergent_WhenPartiallyPaid_TransitionsToDivergent()
    {
        var charge = Charge.Create(Guid.NewGuid(), "REF-001", "ext-001", 100m, FutureExpiry);
        charge.MarkAsPartiallyPaid();

        charge.MarkAsDivergent();

        charge.Status.Should().Be(ChargeStatus.Divergent);
    }

    [Fact]
    public void MarkAsDivergent_WhenOverpaid_ThrowsDomainException()
    {
        var charge = Charge.Create(Guid.NewGuid(), "REF-001", "ext-001", 100m, FutureExpiry);
        charge.MarkAsPartiallyPaid();
        charge.MarkAsOverpaid();

        var act = () => charge.MarkAsDivergent();

        act.Should().Throw<DomainException>();
    }

    // --- MarkAsPartiallyPaid / MarkAsOverpaid ---

    [Fact]
    public void MarkAsPartiallyPaid_WhenPending_TransitionsToPartiallyPaid()
    {
        var charge = Charge.Create(Guid.NewGuid(), "REF-001", "ext-001", 100m, FutureExpiry);
        charge.MarkAsPartiallyPaid();
        charge.Status.Should().Be(ChargeStatus.PartiallyPaid);
    }

    [Fact]
    public void MarkAsPaid_WhenPartiallyPaid_Succeeds()
    {
        var charge = Charge.Create(Guid.NewGuid(), "REF-001", "ext-001", 100m, FutureExpiry);
        charge.MarkAsPartiallyPaid();
        charge.MarkAsPaid();
        charge.Status.Should().Be(ChargeStatus.Paid);
    }

    [Fact]
    public void MarkAsOverpaid_WhenPartiallyPaid_TransitionsToOverpaid()
    {
        var charge = Charge.Create(Guid.NewGuid(), "REF-001", "ext-001", 100m, FutureExpiry);
        charge.MarkAsPartiallyPaid();
        charge.MarkAsOverpaid();
        charge.Status.Should().Be(ChargeStatus.Overpaid);
    }

    [Fact]
    public void MarkAsPaid_WhenOverpaid_ThrowsDomainException()
    {
        var charge = Charge.Create(Guid.NewGuid(), "REF-001", "ext-001", 100m, FutureExpiry);
        charge.MarkAsPartiallyPaid();
        charge.MarkAsOverpaid();

        var act = () => charge.MarkAsPaid();

        act.Should().Throw<DomainException>();
    }

    // --- MarkAsExpired ---

    [Fact]
    public void MarkAsExpired_WhenPending_TransitionsToExpired()
    {
        var charge = CreateExpiredCharge();

        charge.MarkAsExpired();

        charge.Status.Should().Be(ChargeStatus.Expired);
    }

    [Fact]
    public void MarkAsExpired_WhenPaid_ThrowsDomainException()
    {
        var charge = Charge.Create(Guid.NewGuid(), "REF-001", "ext-001", 100m, FutureExpiry);
        charge.MarkAsPaid();

        var act = () => charge.MarkAsExpired();

        act.Should().Throw<DomainException>();
    }

    // --- CanReceivePayment ---

    [Fact]
    public void CanReceivePayment_WhenPending_ReturnsTrue()
    {
        var charge = Charge.Create(Guid.NewGuid(), "REF-001", "ext-001", 100m, FutureExpiry);
        charge.CanReceivePayment().Should().BeTrue();
    }

    [Fact]
    public void CanReceivePayment_WhenPaid_ReturnsFalse()
    {
        var charge = Charge.Create(Guid.NewGuid(), "REF-001", "ext-001", 100m, FutureExpiry);
        charge.MarkAsPaid();
        charge.CanReceivePayment().Should().BeFalse();
    }

    [Fact]
    public void CanReceivePayment_WhenPartiallyPaid_ReturnsTrue()
    {
        var charge = Charge.Create(Guid.NewGuid(), "REF-001", "ext-001", 100m, FutureExpiry);
        charge.MarkAsPartiallyPaid();
        charge.CanReceivePayment().Should().BeTrue();
    }

    [Fact]
    public void CanReceivePayment_WhenOverpaid_ReturnsFalse()
    {
        var charge = Charge.Create(Guid.NewGuid(), "REF-001", "ext-001", 100m, FutureExpiry);
        charge.MarkAsPartiallyPaid();
        charge.MarkAsOverpaid();
        charge.CanReceivePayment().Should().BeFalse();
    }

    // --- Helpers ---

    // Creates a charge that is already past expiry using a far-future expiry then simulates
    // the expired state by creating with expiry just barely in the future for IsExpired checks.
    // For MarkAsExpired tests we need a Pending charge — we use a helper that creates one
    // with expiry far in the future so Create doesn't throw, then we test MarkAsExpired directly.
    private static Charge CreateExpiredCharge()
    {
        // We need a charge that IsExpired() == true but was created validly.
        // We create with 1ms expiry so it expires almost immediately.
        // This can be flaky in very rare cases; for determinism we use reflection.
        var charge = Charge.Create(Guid.NewGuid(), "REF-EXPIRED", "ext-expired", 100m, DateTime.UtcNow.AddSeconds(1));
        // Set ExpiresAt in the past via reflection to simulate expiry
        var prop = typeof(Charge).GetProperty("ExpiresAt")!;
        prop.SetValue(charge, DateTime.UtcNow.AddMinutes(-10));
        return charge;
    }
}
