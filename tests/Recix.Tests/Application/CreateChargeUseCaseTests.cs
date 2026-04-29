using FluentAssertions;
using Recix.Application.DTOs;
using Recix.Application.UseCases;
using Recix.Domain.Enums;
using Recix.Tests.Application.Fakes;

namespace Recix.Tests.Application;

public sealed class CreateChargeUseCaseTests
{
    private static CreateChargeUseCase BuildUseCase(FakeChargeRepository? repo = null) =>
        new(repo ?? new FakeChargeRepository(), new FakePixProvider(), NullLogger<CreateChargeUseCase>.Instance);

    [Fact]
    public async Task Execute_WithValidRequest_ReturnsCreatedCharge()
    {
        var repo = new FakeChargeRepository();
        var useCase = BuildUseCase(repo);

        var response = await useCase.ExecuteAsync(new CreateChargeRequest { Amount = 150.75m, ExpiresInMinutes = 30 });

        response.Id.Should().NotBeEmpty();
        response.Amount.Should().Be(150.75m);
        response.Status.Should().Be("Pending");
        response.ReferenceId.Should().MatchRegex(@"^RECIX-\d{8}-\d{6}$");
        response.ExternalId.Should().StartWith("fakepsp_RECIX");
        repo.All.Should().HaveCount(1);
    }

    [Fact]
    public async Task Execute_WithZeroAmount_ThrowsArgumentException()
    {
        var useCase = BuildUseCase();
        var act = async () => await useCase.ExecuteAsync(new CreateChargeRequest { Amount = 0m, ExpiresInMinutes = 30 });
        await act.Should().ThrowAsync<ArgumentException>().WithMessage("*Amount*");
    }

    [Fact]
    public async Task Execute_WithNegativeAmount_ThrowsArgumentException()
    {
        var useCase = BuildUseCase();
        var act = async () => await useCase.ExecuteAsync(new CreateChargeRequest { Amount = -10m, ExpiresInMinutes = 30 });
        await act.Should().ThrowAsync<ArgumentException>();
    }

    [Fact]
    public async Task Execute_WithZeroExpiry_ThrowsArgumentException()
    {
        var useCase = BuildUseCase();
        var act = async () => await useCase.ExecuteAsync(new CreateChargeRequest { Amount = 100m, ExpiresInMinutes = 0 });
        await act.Should().ThrowAsync<ArgumentException>().WithMessage("*ExpiresInMinutes*");
    }

    [Fact]
    public async Task Execute_ReferenceIdIncludesCurrentDate()
    {
        var useCase = BuildUseCase();
        var response = await useCase.ExecuteAsync(new CreateChargeRequest { Amount = 50m, ExpiresInMinutes = 10 });
        response.ReferenceId.Should().Contain(DateTime.UtcNow.ToString("yyyyMMdd"));
    }

    [Fact]
    public async Task Execute_SecondCharge_HasSequentialReferenceId()
    {
        var repo = new FakeChargeRepository();
        var useCase = BuildUseCase(repo);

        var first = await useCase.ExecuteAsync(new CreateChargeRequest { Amount = 50m, ExpiresInMinutes = 10 });
        var second = await useCase.ExecuteAsync(new CreateChargeRequest { Amount = 75m, ExpiresInMinutes = 10 });

        first.ReferenceId.Should().EndWith("000001");
        second.ReferenceId.Should().EndWith("000002");
    }
}
