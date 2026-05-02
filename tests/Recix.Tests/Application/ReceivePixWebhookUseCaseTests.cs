using FluentAssertions;
using Recix.Application.DTOs;
using Recix.Application.Interfaces;
using Recix.Application.Services;
using Recix.Application.UseCases;
using Recix.Domain.Entities;
using Recix.Domain.Enums;
using Recix.Tests.Application.Fakes;

namespace Recix.Tests.Application;

public sealed class ReceivePixWebhookUseCaseTests
{
    private static readonly Guid ResolvedOrgId = Guid.Parse("22222222-2222-2222-2222-222222222222");

    private static ReceivePixWebhookRequest BuildRequest(string eventId = "evt_001") => new()
    {
        EventId = eventId,
        ExternalChargeId = "ext-001",
        ReferenceId = "RECIX-20260429-000001",
        PaidAmount = 150.75m,
        PaidAt = DateTime.UtcNow,
        Provider = "FakePixProvider"
    };

    private static ReceivePixWebhookUseCase BuildUseCase(
        FakePaymentEventRepository repo,
        FakeChargeRepository? charges = null,
        ICurrentOrganization? currentOrg = null) =>
        new(repo, currentOrg ?? new FakeCurrentOrganization(), charges ?? new FakeChargeRepository(),
            new NullPaymentProcessorWake(), new PaymentReliabilityMetrics(),
            NullLogger<ReceivePixWebhookUseCase>.Instance);

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

    [Fact]
    public async Task Execute_WithoutJwtOrg_ResolvesOrganizationFromExternalChargeId()
    {
        var charges = new FakeChargeRepository();
        var charge = Charge.Create(ResolvedOrgId, "REF-W", "ext-efi-resolve", 99m, DateTime.UtcNow.AddHours(1));
        await charges.AddAsync(charge);

        var repo = new FakePaymentEventRepository();
        var req = new ReceivePixWebhookRequest
        {
            EventId          = "evt_efibank_1",
            ExternalChargeId = "ext-efi-resolve",
            ReferenceId      = null,
            PaidAmount       = 99m,
            PaidAt           = DateTime.UtcNow,
            Provider         = "EfiBank",
        };

        await BuildUseCase(repo, charges, new FakeWebhookOrganizationContext()).ExecuteAsync(req);

        repo.All.Should().HaveCount(1);
        repo.All[0].OrganizationId.Should().Be(ResolvedOrgId);
    }

    [Fact]
    public async Task Execute_WithoutJwtOrg_ResolvesOrganizationFromReferenceId()
    {
        var charges = new FakeChargeRepository();
        var charge = Charge.Create(ResolvedOrgId, "REF-ONLY-XYZ", "ext-ignored", 40m, DateTime.UtcNow.AddHours(1));
        await charges.AddAsync(charge);

        var repo = new FakePaymentEventRepository();
        var req = new ReceivePixWebhookRequest
        {
            EventId          = "evt_ref_only",
            ExternalChargeId = null,
            ReferenceId      = "REF-ONLY-XYZ",
            PaidAmount       = 40m,
            PaidAt           = DateTime.UtcNow,
            Provider         = "EfiBank",
        };

        await BuildUseCase(repo, charges, new FakeWebhookOrganizationContext()).ExecuteAsync(req);

        repo.All[0].OrganizationId.Should().Be(ResolvedOrgId);
    }
}
