using FluentAssertions;
using Recix.Domain.Entities;
using Recix.Domain.Enums;
using Recix.Domain.Exceptions;

namespace Recix.Tests.Domain;

public sealed class PaymentEventTests
{
    private static PaymentEvent BuildEvent(decimal paidAmount = 100m) =>
        PaymentEvent.Create(Guid.NewGuid(), "evt_001", "ext-001", "REF-001", paidAmount, DateTime.UtcNow, "FakeProvider", "{}");

    // --- Create ---

    [Fact]
    public void Create_WithValidData_ReturnsReceivedEvent()
    {
        var evt = BuildEvent();

        evt.Id.Should().NotBeEmpty();
        evt.EventId.Should().Be("evt_001");
        evt.Status.Should().Be(PaymentEventStatus.Received);
        evt.ProcessedAt.Should().BeNull();
        evt.RawPayload.Should().Be("{}");
    }

    [Fact]
    public void Create_WithZeroPaidAmount_ThrowsDomainException()
    {
        var act = () => BuildEvent(0m);
        act.Should().Throw<DomainException>().WithMessage("*greater than zero*");
    }

    [Fact]
    public void Create_WithNegativePaidAmount_ThrowsDomainException()
    {
        var act = () => BuildEvent(-50m);
        act.Should().Throw<DomainException>();
    }

    // --- State transitions ---

    [Fact]
    public void MarkAsProcessing_WhenReceived_TransitionsToProcessing()
    {
        var evt = BuildEvent();

        evt.MarkAsProcessing();

        evt.Status.Should().Be(PaymentEventStatus.Processing);
    }

    [Fact]
    public void MarkAsProcessing_WhenNotReceived_ThrowsDomainException()
    {
        var evt = BuildEvent();
        evt.MarkAsProcessing();

        var act = () => evt.MarkAsProcessing();

        act.Should().Throw<DomainException>();
    }

    [Fact]
    public void MarkAsProcessed_WhenProcessing_TransitionsToProcessed()
    {
        var evt = BuildEvent();
        evt.MarkAsProcessing();

        evt.MarkAsProcessed();

        evt.Status.Should().Be(PaymentEventStatus.Processed);
        evt.ProcessedAt.Should().NotBeNull();
    }

    [Fact]
    public void MarkAsProcessed_WhenNotProcessing_ThrowsDomainException()
    {
        var evt = BuildEvent();

        var act = () => evt.MarkAsProcessed();

        act.Should().Throw<DomainException>();
    }

    [Fact]
    public void MarkAsFailed_FromAnyState_TransitionsToFailed()
    {
        var evt = BuildEvent();
        evt.MarkAsProcessing();

        evt.MarkAsFailed();

        evt.Status.Should().Be(PaymentEventStatus.Failed);
        evt.ProcessedAt.Should().NotBeNull();
    }

    [Fact]
    public void MarkAsIgnoredDuplicate_SetsCorrectStatus()
    {
        var evt = BuildEvent();

        evt.MarkAsIgnoredDuplicate();

        evt.Status.Should().Be(PaymentEventStatus.IgnoredDuplicate);
    }

    // --- Full happy path ---

    [Fact]
    public void FullTransition_Received_Processing_Processed_Succeeds()
    {
        var evt = BuildEvent();

        evt.MarkAsProcessing();
        evt.MarkAsProcessed();

        evt.Status.Should().Be(PaymentEventStatus.Processed);
        evt.ProcessedAt.Should().NotBeNull();
    }
}
