using FluentAssertions;
using Recix.Application.DTOs;
using Recix.Application.Services;
using Recix.Application.UseCases;
using Recix.Domain.Enums;
using Recix.Tests.Application.Fakes;

namespace Recix.Tests.Application;

public sealed class ReceivePixWebhookUseCaseTests
{
    private static ReceivePixWebhookRequest BuildRequest(string eventId = "evt_001") => new()
    {
        EventId = eventId,
        ExternalChargeId = "ext-001",
        ReferenceId = "RECIX-20260429-000001",
        PaidAmount = 150.75m,
        PaidAt = DateTime.UtcNow,
        Provider = "FakePixProvider"
    };

    private static ReceivePixWebhookUseCase BuildUseCase(FakePaymentEventRepository repo) =>
        new(repo, new FakeCurrentOrganization(), new PaymentReliabilityMetrics(), NullLogger<ReceivePixWebhookUseCase>.Instance);

    [Fact]
    public async Task Execute_NewEvent_ReturnsReceived()
    {
        var repo = new FakePaymentEventRepository();
        var response = await BuildUseCase(repo).ExecuteAsync(BuildRequest());

        response.Received.Should().BeTrue();
        response.Status.Should().Be("Received");
        response.EventId.Should().Be("evt_001");
        repo.All.Should().HaveCount(1);
    }

    [Fact]
    public async Task Execute_NewEvent_PersistsRawPayload()
    {
        var repo = new FakePaymentEventRepository();
        await BuildUseCase(repo).ExecuteAsync(BuildRequest());

        repo.All[0].RawPayload.Should().NotBeNullOrEmpty();
        repo.All[0].Status.Should().Be(PaymentEventStatus.Received);
    }

    [Fact]
    public async Task Execute_DuplicateEventId_ReturnsIgnoredDuplicate()
    {
        var repo = new FakePaymentEventRepository();
        var useCase = BuildUseCase(repo);

        await useCase.ExecuteAsync(BuildRequest("evt_dup"));
        var response = await useCase.ExecuteAsync(BuildRequest("evt_dup"));

        response.Status.Should().Be("IgnoredDuplicate");
        repo.All.Should().HaveCount(1);
    }

    [Fact]
    public async Task Execute_DuplicateEvent_DoesNotPersistNewRecord()
    {
        var repo = new FakePaymentEventRepository();
        var useCase = BuildUseCase(repo);

        await useCase.ExecuteAsync(BuildRequest("evt_dup"));
        await useCase.ExecuteAsync(BuildRequest("evt_dup"));
        await useCase.ExecuteAsync(BuildRequest("evt_dup"));

        repo.All.Should().HaveCount(1);
    }

    [Fact]
    public async Task Execute_TwoDistinctEvents_BothPersisted()
    {
        var repo = new FakePaymentEventRepository();
        var useCase = BuildUseCase(repo);

        await useCase.ExecuteAsync(BuildRequest("evt_001"));
        await useCase.ExecuteAsync(BuildRequest("evt_002"));

        repo.All.Should().HaveCount(2);
    }

    [Fact]
    public async Task Execute_SameEventFiveTimesConcurrently_PersistsOnlyOne()
    {
        var repo = new FakePaymentEventRepository();
        var useCase = BuildUseCase(repo);

        var tasks = Enumerable.Range(0, 5)
            .Select(_ => useCase.ExecuteAsync(BuildRequest("evt_parallel")))
            .ToArray();

        var responses = await Task.WhenAll(tasks);

        repo.All.Should().HaveCount(1);
        responses.Count(r => r.Status == "Received").Should().Be(1);
        responses.Count(r => r.Status == "IgnoredDuplicate").Should().Be(4);
    }
}
