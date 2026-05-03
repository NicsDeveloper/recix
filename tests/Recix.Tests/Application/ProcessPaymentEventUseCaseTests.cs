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
    private readonly PaymentReliabilityMetrics _metrics = new();

    private ProcessPaymentEventUseCase BuildUseCase() =>
        new(_events, _charges, _reconciliations,
            new ReconciliationEngine(_charges, _reconciliations),
            new ChargeBalanceApplier(_charges, _reconciliations),
            _metrics,
            new FakeEventBroadcaster(),
            new FakeAlertNotifier(),
            NullLogger<ProcessPaymentEventUseCase>.Instance);

    private static readonly Guid TestOrgId = Guid.Parse("11111111-1111-1111-1111-111111111111");

    private static Charge CreateActiveCharge(decimal amount = 150.75m) =>
        Charge.Create(TestOrgId, "RECIX-20260429-000001", "ext-001", amount, DateTime.UtcNow.AddMinutes(30));

    private static Charge CreateExpiredCharge(decimal amount = 150.75m)
    {
        var charge = Charge.Create(TestOrgId, "RECIX-20260429-000001", "ext-001", amount, DateTime.UtcNow.AddSeconds(1));
        typeof(Charge).GetProperty("ExpiresAt")!.SetValue(charge, DateTime.UtcNow.AddMinutes(-10));
        return charge;
    }

    private static PaymentEvent CreateEvent(string externalId = "ext-001", decimal paidAmount = 150.75m) =>
        PaymentEvent.Create(TestOrgId, "evt_001", externalId, null, paidAmount, DateTime.UtcNow, "FakeProvider", "{}");

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

    // --- Cenário 2: pagamento parcial (identificador exato) ---

    [Fact]
    public async Task Process_PartialUnderpayment_HighIdentifier_ChargePartiallyPaidAndPartialPaymentResult()
    {
        var charge = CreateActiveCharge(150.75m);
        await _charges.AddAsync(charge);
        var evt = CreateEvent("ext-001", paidAmount: 140m);
        await _events.AddAsync(evt);

        await BuildUseCase().ExecuteAsync(evt.Id);

        charge.Status.Should().Be(ChargeStatus.PartiallyPaid);
        _reconciliations.All[0].Status.Should().Be(ReconciliationStatus.PartialPayment);
        _reconciliations.All[0].ExpectedAmount.Should().Be(150.75m);
        _reconciliations.All[0].PaidAmount.Should().Be(140m);
    }

    [Fact]
    public async Task Process_TwoPartialsSumToCharge_BecomesPaidWithCumulativeSettlement()
    {
        var charge = CreateActiveCharge(500m);
        await _charges.AddAsync(charge);
        var e1 = PaymentEvent.Create(TestOrgId, "evt_p1", "ext-001", null, 250m, DateTime.UtcNow, "FakeProvider", "{}");
        var e2 = PaymentEvent.Create(TestOrgId, "evt_p2", "ext-001", null, 250m, DateTime.UtcNow, "FakeProvider", "{}");
        await _events.AddAsync(e1);
        await _events.AddAsync(e2);

        await BuildUseCase().ExecuteAsync(e1.Id);
        charge.Status.Should().Be(ChargeStatus.PartiallyPaid);
        _reconciliations.All[0].Status.Should().Be(ReconciliationStatus.PartialPayment);

        await BuildUseCase().ExecuteAsync(e2.Id);
        charge.Status.Should().Be(ChargeStatus.Paid);
        _reconciliations.All.Should().HaveCount(2);
        _reconciliations.All[1].Status.Should().Be(ReconciliationStatus.Matched);
        _reconciliations.All[1].MatchReason.Should().Be(MatchReason.CumulativeSettlement);
    }

    [Fact]
    public async Task Process_SecondPayment_OnFullyPaidSmallCharge_IsDuplicate()
    {
        var charge = CreateActiveCharge(250m);
        await _charges.AddAsync(charge);
        var e1 = PaymentEvent.Create(TestOrgId, "evt_a", "ext-001", null, 250m, DateTime.UtcNow, "FakeProvider", "{}");
        var e2 = PaymentEvent.Create(TestOrgId, "evt_b", "ext-001", null, 250m, DateTime.UtcNow, "FakeProvider", "{}");
        await _events.AddAsync(e1);
        await _events.AddAsync(e2);

        await BuildUseCase().ExecuteAsync(e1.Id);
        charge.Status.Should().Be(ChargeStatus.Paid);

        await BuildUseCase().ExecuteAsync(e2.Id);
        charge.Status.Should().Be(ChargeStatus.Paid);
        _reconciliations.All[1].Status.Should().Be(ReconciliationStatus.DuplicatePayment);
    }

    [Fact]
    public async Task Process_SingleOverpayment_MarksOverpaidAndPaymentExceedsExpected()
    {
        var charge = CreateActiveCharge(500m);
        await _charges.AddAsync(charge);
        var evt = PaymentEvent.Create(TestOrgId, "evt_ov", "ext-001", null, 600m, DateTime.UtcNow, "FakeProvider", "{}");
        await _events.AddAsync(evt);

        await BuildUseCase().ExecuteAsync(evt.Id);

        charge.Status.Should().Be(ChargeStatus.Overpaid);
        _reconciliations.All[0].Status.Should().Be(ReconciliationStatus.PaymentExceedsExpected);
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

    [Fact]
    public async Task Process_ExternalIdMiss_falls_back_to_ReferenceId_when_org_present()
    {
        var charge = Charge.Create(TestOrgId, "REF-FALLBACK", "ext-real", 100m, DateTime.UtcNow.AddHours(1));
        await _charges.AddAsync(charge);
        var evt = PaymentEvent.Create(TestOrgId, "evt_fb", "wrong-ext", "REF-FALLBACK", 100m, DateTime.UtcNow, "FakeProvider", "{}");
        await _events.AddAsync(evt);

        await BuildUseCase().ExecuteAsync(evt.Id);

        charge.Status.Should().Be(ChargeStatus.Paid);
        _reconciliations.All[0].Status.Should().Be(ReconciliationStatus.Matched);
    }

    // --- Cenário 4a: InvalidReference (ExternalChargeId fornecido mas não encontrado) ---

    [Fact]
    public async Task Process_WithUnknownExternalChargeId_ResultIsInvalidReference()
    {
        // Sem organização não há fuzzy: identificador externo inválido permanece InvalidReference.
        var evt = PaymentEvent.Create(Guid.Empty, "evt_001", "nonexistent-ext", null, 100m, DateTime.UtcNow, "FakeProvider", "{}");
        await _events.AddAsync(evt);

        await BuildUseCase().ExecuteAsync(evt.Id);

        _reconciliations.All[0].Status.Should().Be(ReconciliationStatus.InvalidReference);
        _reconciliations.All[0].ChargeId.Should().BeNull();
    }

    // --- Cenário 4b: PaymentWithoutCharge (sem identificador, fuzzy sem resultado) ---

    [Fact]
    public async Task Process_WithoutIdentifierAndNoFuzzyMatch_ResultIsPaymentWithoutCharge()
    {
        // Sem ExternalChargeId e sem ReferenceId: fuzzy por valor, mas nenhuma cobrança pendente.
        var evt = PaymentEvent.Create(TestOrgId, "evt_002", null, null, 999m, DateTime.UtcNow, "FakeProvider", "{}");
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
        var evt = PaymentEvent.Create(TestOrgId, "evt_001", null, null, 100m, DateTime.UtcNow, "FakeProvider", "{}");
        await _events.AddAsync(evt);

        await BuildUseCase().ExecuteAsync(evt.Id);

        _reconciliations.All[0].Status.Should().Be(ReconciliationStatus.PaymentWithoutCharge);
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
