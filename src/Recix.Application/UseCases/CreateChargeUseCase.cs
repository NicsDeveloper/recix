using Microsoft.Extensions.Logging;
using Recix.Application.DTOs;
using Recix.Application.Interfaces;
using Recix.Domain.Entities;

namespace Recix.Application.UseCases;

public sealed class CreateChargeUseCase
{
    private readonly IChargeRepository _charges;
    private readonly ILogger<CreateChargeUseCase> _logger;

    public CreateChargeUseCase(IChargeRepository charges, ILogger<CreateChargeUseCase> logger)
    {
        _charges = charges;
        _logger = logger;
    }

    public async Task<CreateChargeResponse> ExecuteAsync(CreateChargeRequest request, CancellationToken cancellationToken = default)
    {
        if (request.Amount <= 0)
            throw new ArgumentException("Amount must be greater than zero.", nameof(request));

        if (request.ExpiresInMinutes <= 0)
            throw new ArgumentException("ExpiresInMinutes must be greater than zero.", nameof(request));

        var referenceId = await GenerateReferenceIdAsync(cancellationToken);
        var externalId = $"fakepsp_{Guid.NewGuid():N}";
        var expiresAt = DateTime.UtcNow.AddMinutes(request.ExpiresInMinutes);

        var charge = Charge.Create(referenceId, externalId, request.Amount, expiresAt);

        await _charges.AddAsync(charge, cancellationToken);

        _logger.LogInformation("Charge created: {ChargeId} ReferenceId={ReferenceId} Amount={Amount}",
            charge.Id, charge.ReferenceId, charge.Amount);

        return new CreateChargeResponse
        {
            Id = charge.Id,
            ReferenceId = charge.ReferenceId,
            ExternalId = charge.ExternalId,
            Amount = charge.Amount,
            Status = charge.Status.ToString(),
            ExpiresAt = charge.ExpiresAt,
            CreatedAt = charge.CreatedAt
        };
    }

    // Format: RECIX-{YYYYMMDD}-{NNNNNN} (decisions.md D002)
    private async Task<string> GenerateReferenceIdAsync(CancellationToken cancellationToken)
    {
        var today = DateTime.UtcNow.Date;
        var count = await _charges.CountByDateAsync(today, cancellationToken);
        return $"RECIX-{today:yyyyMMdd}-{count + 1:D6}";
    }
}
