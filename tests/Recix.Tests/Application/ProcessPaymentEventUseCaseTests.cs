using FluentAssertions;
using Recix.Application.Services;
using Recix.Application.UseCases;
using Recix.Domain.Entities;
using Recix.Domain.Enums;
using Recix.Tests.Application.Fakes;

namespace Recix.Tests.Application;

public sealed class ProcessPaymentEventUseCaseTests
{
    private readonly FakeChargeRepository _charges = new();
    private readonly FakePaymentEventRepository _events = new();
    private readonly FakeReconciliationRepository _reconciliations = new();

    private ProcessPaymentEventUseCase BuildUseCase() =>
        new(_events, _charges, _reconciliations,
            new ReconciliationEngine(_charges),
            NullLogger<ProcessPaymentEventUseCase>.Instance);

    private static Charge CreateActiveCharge(decimal amount = 150.75m) =>
        Charge.Create("RECIX-20260429-000001", "ext-001", amount, DateTime.UtcNow.AddMinutes(30));

    private static Charge CreateExpiredCharge(decimal amount = 150.75m)
    {
        var charge = Charge.Create("RECIX-20260429-000001", "ext-001", amount, DateTime.UtcNow.AddSeconds(1));
        typeof(Charge).GetProperty("ExpiresAt")!.SetValue(charge, DateTime.UtcNow.AddMinutes(-10));
        return charge;
    }

    private static PaymentEvent CreateEvent(string externalId = "ext-001", decimal paidAmount = 150.75m) =>
        PaymentEvent.Create("evt_001", externalId, null, paidAmount, DateTime.UtcNow, "FakeProvider", "{}");

    // --- Cenário 1: Matched ---

    [Fact]
    public async Task Process_MatchedPayment_ChargeBecomesPayedAndResultIsMatched()
    {
        var charge = CreateActiveCharge(150.75m);
        await _charges.AddAsync(charge);
        var evt = CreateEvent("ext-001", 150.75m);
        await _events.AddAsync(evt);

        await BuildUseCase().ExecuteAsync(evt.Id);

        charge.Status.Should().Be(ChargeStatus.Paid);
        _reconciliations.All.Should().HaveCount(1);
        _reconciliations.All[0].Status.Should().Be(ReconciliationStatus.Matched);
        _events.All[0].Status.Should().Be(PaymentEventStatus.Processed);
    }

    // --- Cenário 2: AmountMismatch ---

    [Fact]
    public async Task Process_AmountMismatch_ChargeBecomsDivergentAndResultIsAmountMismatch()
    {
        var charge = CreateActiveCharge(150.75m);
        await _charges.AddAsync(charge);
        var evt = CreateEvent("ext-001", paidAmount: 140m);
        await _events.AddAsync(evt);

        await BuildUseCase().ExecuteAsync(evt.Id);

        charge.Status.Should().Be(ChargeStatus.Divergent);
        _reconciliations.All[0].Status.Should().Be(ReconciliationStatus.AmountMismatch);
        _reconciliations.All[0].ExpectedAmount.Should().Be(150.75m);
        _reconciliations.All[0].PaidAmount.Should().Be(140m);
    }

    // --- Cenário 3: DuplicatePayment ---

    [Fact]
    public async Task Process_DuplicatePayment_ChargeRemainsPayedAndResultIsDuplicate()
    {
        var charge = CreateActiveCharge(150.75m);
        charge.MarkAsPaid();
        await _charges.AddAsync(charge);
        var evt = CreateEvent("ext-001", 150.75m);
        await _events.AddAsync(evt);

        await BuildUseCase().ExecuteAsync(evt.Id);

        charge.Status.Should().Be(ChargeStatus.Paid);
        _reconciliations.All[0].Status.Should().Be(ReconciliationStatus.DuplicatePayment);
    }

    // --- Cenário 4: PaymentWithoutCharge ---

    [Fact]
    public async Task Process_PaymentWithoutCharge_ResultIsPaymentWithoutCharge()
    {
        var evt = PaymentEvent.Create("evt_001", "nonexistent-ext", null, 100m, DateTime.UtcNow, "FakeProvider", "{}");
        await _events.AddAsync(evt);

        await BuildUseCase().ExecuteAsync(evt.Id);

        _reconciliations.All[0].Status.Should().Be(ReconciliationStatus.PaymentWithoutCharge);
        _reconciliations.All[0].ChargeId.Should().BeNull();
    }

    // --- Cenário 5: ExpiredChargePaid ---

    [Fact]
    public async Task Process_ExpiredChargePaid_ChargeBecomesDivergentAndResultIsExpiredChargePaid()
    {
        var charge = CreateExpiredCharge(150.75m);
        await _charges.AddAsync(charge);
        var evt = CreateEvent("ext-001", 150.75m);
        await _events.AddAsync(evt);

        await BuildUseCase().ExecuteAsync(evt.Id);

        charge.Status.Should().Be(ChargeStatus.Divergent);
        _reconciliations.All[0].Status.Should().Be(ReconciliationStatus.ExpiredChargePaid);
    }

    // --- Cenário 6: InvalidReference ---

    [Fact]
    public async Task Process_InvalidReference_ResultIsInvalidReference()
    {
        var evt = PaymentEvent.Create("evt_001", null, null, 100m, DateTime.UtcNow, "FakeProvider", "{}");
        await _events.AddAsync(evt);

        await BuildUseCase().ExecuteAsync(evt.Id);

        _reconciliations.All[0].Status.Should().Be(ReconciliationStatus.InvalidReference);
    }

    // --- Resiliência: evento não encontrado ---

    [Fact]
    public async Task Process_EventNotFound_DoesNothingGracefully()
    {
        await BuildUseCase().ExecuteAsync(Guid.NewGuid());
        _reconciliations.All.Should().BeEmpty();
    }

    // --- Transição de status do evento ---

    [Fact]
    public async Task Process_AfterProcessing_EventStatusIsProcessed()
    {
        var charge = CreateActiveCharge();
        await _charges.AddAsync(charge);
        var evt = CreateEvent();
        await _events.AddAsync(evt);

        await BuildUseCase().ExecuteAsync(evt.Id);

        _events.All[0].Status.Should().Be(PaymentEventStatus.Processed);
        _events.All[0].ProcessedAt.Should().NotBeNull();
    }
}
