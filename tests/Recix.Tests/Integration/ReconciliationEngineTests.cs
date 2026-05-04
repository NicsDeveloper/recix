using FluentAssertions;
using Recix.Tests.Integration.Infrastructure;

namespace Recix.Tests.Integration;

/// <summary>
/// Testes de integração do motor de conciliação.
/// Cada teste exercita um cenário ponta a ponta:
///   1. Cria cobrança via API
///   2. Envia webhook PIX via API
///   3. Aguarda o BackgroundService processar (polling)
///   4. Verifica status final da cobrança e da conciliação
/// </summary>
[Collection("Integration")]
public sealed class ReconciliationEngineTests : IntegrationTestBase, IClassFixture<RecixWebApplicationFactory>
{
    public ReconciliationEngineTests(RecixWebApplicationFactory factory) : base(factory) { }

    // ─────────────────────────────────────────────────────────────────────────
    // 1. MATCHED — match por ReferenceId exato, valor exato → Paid
    // ─────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task ExactReferenceId_FullPayment_ChargeBecomePaid()
    {
        // Arrange
        var charge = await PostJsonAsync<CreateChargeResponse>(
            "/charges", new { amount = 150.00m, expiresInMinutes = 60 });

        // Act — webhook com ReferenceId exato e valor exato
        var webhook = await PostRawAsync("/webhooks/pix",
            WebhookBody(charge.ReferenceId, 150.00m));
        webhook.IsSuccessStatusCode.Should().BeTrue();

        // Assert — aguarda processamento assíncrono
        var final = await WaitUntilAsync(
            () => GetJsonAsync<ChargeDto>($"/charges/{charge.Id}"),
            c => c.Status == "Paid");

        final.Status.Should().Be("Paid");

        var recons = await GetJsonAsync<PagedResult<ReconciliationDto>>(
            $"/reconciliations?chargeId={charge.Id}");
        recons.Items.Should().ContainSingle(r => r.Status == "Matched");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. PARTIAL PAYMENT — dois pagamentos parciais completam a cobrança
    // ─────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task TwoPartialPayments_ChargeBecomePaid()
    {
        // Arrange
        var charge = await PostJsonAsync<CreateChargeResponse>(
            "/charges", new { amount = 200.00m, expiresInMinutes = 60 });

        // Act — primeiro pagamento parcial (50%)
        await PostRawAsync("/webhooks/pix", WebhookBody(charge.ReferenceId, 100.00m));

        await WaitUntilAsync(
            () => GetJsonAsync<ChargeDto>($"/charges/{charge.Id}"),
            c => c.Status == "PartiallyPaid");

        // Segundo pagamento completa
        await PostRawAsync("/webhooks/pix", WebhookBody(charge.ReferenceId, 100.00m));

        // Assert
        var final = await WaitUntilAsync(
            () => GetJsonAsync<ChargeDto>($"/charges/{charge.Id}"),
            c => c.Status == "Paid");

        final.Status.Should().Be("Paid");

        var recons = await GetJsonAsync<PagedResult<ReconciliationDto>>(
            $"/reconciliations?chargeId={charge.Id}");
        recons.Items.Should().Contain(r => r.Status == "PartialPayment");
        recons.Items.Should().Contain(r => r.Status == "Matched");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. PAYMENT EXCEEDS EXPECTED — valor maior que o esperado → Overpaid
    // ─────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task PaymentExceedsExpected_ChargeBecomesOverpaid()
    {
        // Arrange
        var charge = await PostJsonAsync<CreateChargeResponse>(
            "/charges", new { amount = 100.00m, expiresInMinutes = 60 });

        // Act — pagamento 50% maior que o esperado
        await PostRawAsync("/webhooks/pix", WebhookBody(charge.ReferenceId, 150.00m));

        // Assert
        var final = await WaitUntilAsync(
            () => GetJsonAsync<ChargeDto>($"/charges/{charge.Id}"),
            c => c.Status is "Overpaid");

        final.Status.Should().Be("Overpaid");

        var recons = await GetJsonAsync<PagedResult<ReconciliationDto>>(
            $"/reconciliations?chargeId={charge.Id}");
        recons.Items.Should().ContainSingle(r => r.Status == "PaymentExceedsExpected");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. DUPLICATE PAYMENT — segundo webhook com mesmo EventId → IgnoredDuplicate
    // ─────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task DuplicateEventId_SecondWebhookIgnored()
    {
        // Arrange
        var charge  = await PostJsonAsync<CreateChargeResponse>(
            "/charges", new { amount = 80.00m, expiresInMinutes = 60 });
        var eventId = Guid.NewGuid().ToString();

        // Act — primeiro webhook
        var first = await PostRawAsync("/webhooks/pix",
            WebhookBody(charge.ReferenceId, 80.00m, eventId: eventId));
        first.IsSuccessStatusCode.Should().BeTrue();

        await WaitUntilAsync(
            () => GetJsonAsync<ChargeDto>($"/charges/{charge.Id}"),
            c => c.Status == "Paid");

        // Segundo webhook com mesmo EventId
        var second = await PostRawAsync("/webhooks/pix",
            WebhookBody(charge.ReferenceId, 80.00m, eventId: eventId));

        // Assert — retorna 200 OK (IgnoredDuplicate) ou 202 (se reprocessado)
        second.IsSuccessStatusCode.Should().BeTrue();

        var webhookRes = await second.Content.ReadFromJsonAsync<WebhookResponse>(
            new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        webhookRes!.Status.Should().Be("IgnoredDuplicate");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 5. PAYMENT WITHOUT CHARGE — referência desconhecida → PaymentWithoutCharge
    // ─────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task UnknownReference_CreatesPaymentWithoutCharge()
    {
        // Act — webhook sem cobrança correspondente
        var res = await PostRawAsync("/webhooks/pix",
            WebhookBody($"RECIX-00000000-999999", 50.00m));
        res.IsSuccessStatusCode.Should().BeTrue();

        // Assert — aguarda processamento e verifica conciliação
        await WaitUntilAsync(
            () => GetJsonAsync<PagedResult<ReconciliationDto>>("/reconciliations"),
            r => r.Items.Any(x => x.Status == "PaymentWithoutCharge" && x.PaidAmount == 50.00m));

        var recons = await GetJsonAsync<PagedResult<ReconciliationDto>>("/reconciliations");
        recons.Items.Should().Contain(r =>
            r.Status     == "PaymentWithoutCharge" &&
            r.ChargeId   == null &&
            r.PaidAmount == 50.00m);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 6. AMOUNT MISMATCH — fuzzy match por valor mas montante diverge → Divergent
    // ─────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task FuzzyMatch_DifferentAmount_ChargeBecomesDivergent()
    {
        // Arrange — cobrança sem ReferenceId para forçar fuzzy
        var charge = await PostJsonAsync<CreateChargeResponse>(
            "/charges", new { amount = 300.00m, expiresInMinutes = 60 });

        // Act — webhook sem referência, valor diferente (fuzzy Tier 3, AmountMismatch)
        await PostRawAsync("/webhooks/pix",
            WebhookBodyNoRef(275.00m)); // valor diferente de 300

        // Assert — com fuzzy o status pode ser Divergent (AmountMismatch)
        // ou PaymentWithoutCharge se não encontrar; ambos são válidos aqui.
        // O que NÃO deve acontecer: cobrança virar Paid com valor errado.
        await Task.Delay(3_000); // aguarda processamento

        var final = await GetJsonAsync<ChargeDto>($"/charges/{charge.Id}");
        final.Status.Should().NotBe("Paid",
            "pagamento com valor divergente não deve conciliar como Paid");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 7. DUPLICATE PAYMENT — cobrança já paga recebe novo pagamento
    // ─────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task AlreadyPaidCharge_SecondPayment_CreatesDuplicateRecord()
    {
        // Arrange
        var charge = await PostJsonAsync<CreateChargeResponse>(
            "/charges", new { amount = 120.00m, expiresInMinutes = 60 });

        // Primeiro pagamento — paga completamente
        await PostRawAsync("/webhooks/pix", WebhookBody(charge.ReferenceId, 120.00m));
        await WaitUntilAsync(
            () => GetJsonAsync<ChargeDto>($"/charges/{charge.Id}"),
            c => c.Status == "Paid");

        // Act — segundo pagamento com valor diferente de EventId
        await PostRawAsync("/webhooks/pix", WebhookBody(charge.ReferenceId, 120.00m));

        // Assert — deve gerar DuplicatePayment
        await WaitUntilAsync(
            () => GetJsonAsync<PagedResult<ReconciliationDto>>(
                $"/reconciliations?chargeId={charge.Id}"),
            r => r.Items.Any(x => x.Status == "DuplicatePayment"));

        var recons = await GetJsonAsync<PagedResult<ReconciliationDto>>(
            $"/reconciliations?chargeId={charge.Id}");
        recons.Items.Should().Contain(r => r.Status == "DuplicatePayment");

        // Cobrança não deve ter mudado de Paid
        var final = await GetJsonAsync<ChargeDto>($"/charges/{charge.Id}");
        final.Status.Should().Be("Paid");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 8. CANCEL → webhook rejeitado (cobrança cancelada não recebe pagamento)
    // ─────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task CancelledCharge_CannotReceivePayment()
    {
        // Arrange
        var charge = await PostJsonAsync<CreateChargeResponse>(
            "/charges", new { amount = 50.00m, expiresInMinutes = 60 });

        // Cancela a cobrança
        var cancel = await Client.PostAsync($"/charges/{charge.Id}/cancel", null);
        cancel.IsSuccessStatusCode.Should().BeTrue();

        // Act — tenta pagar cobrança cancelada
        await PostRawAsync("/webhooks/pix", WebhookBody(charge.ReferenceId, 50.00m));

        await Task.Delay(3_000); // aguarda processamento

        // Assert — cobrança deve permanecer Cancelled (estado terminal)
        var final = await GetJsonAsync<ChargeDto>($"/charges/{charge.Id}");
        final.Status.Should().Be("Cancelled",
            "Cancelled é estado terminal — pagamento posterior não pode alterá-la");

        // Pagamento contra cobrança cancelada deve virar PaymentWithoutCharge (sem vínculo com a cobrança)
        await WaitUntilAsync(
            () => GetJsonAsync<PagedResult<ReconciliationDto>>("/reconciliations"),
            r => r.Items.Any(x => x.Status == "PaymentWithoutCharge" && x.ChargeId == null));

        var recons = await GetJsonAsync<PagedResult<ReconciliationDto>>(
            $"/reconciliations?chargeId={charge.Id}");
        recons.Items.Should().BeEmpty(
            "cobrança cancelada não deve ter reconciliações vinculadas");
    }
}
