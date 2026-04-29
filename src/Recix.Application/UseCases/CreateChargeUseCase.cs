using Microsoft.Extensions.Logging;
using Recix.Application.DTOs;
using Recix.Application.Interfaces;
using Recix.Domain.Entities;

namespace Recix.Application.UseCases;

public sealed class CreateChargeUseCase
{
    private readonly IChargeRepository _charges;
    private readonly IPixProvider _pixProvider;
    private readonly ILogger<CreateChargeUseCase> _logger;

    private readonly ICurrentOrganization _currentOrg;

    public CreateChargeUseCase(
        IChargeRepository charges,
        IPixProvider pixProvider,
        ICurrentOrganization currentOrg,
        ILogger<CreateChargeUseCase> logger)
    {
        _charges     = charges;
        _pixProvider = pixProvider;
        _currentOrg  = currentOrg;
        _logger      = logger;
    }

    public async Task<CreateChargeResponse> ExecuteAsync(CreateChargeRequest request, CancellationToken cancellationToken = default)
    {
        if (request.Amount <= 0)
            throw new ArgumentException("Amount must be greater than zero.", nameof(request));

        if (request.ExpiresInMinutes <= 0)
            throw new ArgumentException("ExpiresInMinutes must be greater than zero.", nameof(request));

        var orgId = _currentOrg.OrganizationId
            ?? throw new UnauthorizedAccessException("Contexto de organização não disponível.");

        var referenceId = await GenerateReferenceIdAsync(cancellationToken);
        var expiresAt   = DateTime.UtcNow.AddMinutes(request.ExpiresInMinutes);

        // Cria a cobrança no PSP (real ou fake) → obtém QR Code
        var pixResult = await _pixProvider.CreateChargeAsync(referenceId, request.Amount, expiresAt, cancellationToken);

        // ExternalId = txId do PSP (usado na conciliação por ReferenceId)
        var charge = Charge.Create(orgId, referenceId, pixResult.TxId, request.Amount, expiresAt);
        charge.SetPixCopiaECola(pixResult.PixCopiaECola);

        await _charges.AddAsync(charge, cancellationToken);

        _logger.LogInformation(
            "Charge created: {ChargeId} ReferenceId={ReferenceId} Amount={Amount} TxId={TxId}",
            charge.Id, charge.ReferenceId, charge.Amount, pixResult.TxId);

        return new CreateChargeResponse
        {
            Id            = charge.Id,
            ReferenceId   = charge.ReferenceId,
            ExternalId    = charge.ExternalId,
            Amount        = charge.Amount,
            Status        = charge.Status.ToString(),
            ExpiresAt     = charge.ExpiresAt,
            CreatedAt     = charge.CreatedAt,
            PixCopiaECola = charge.PixCopiaECola
        };
    }

    private async Task<string> GenerateReferenceIdAsync(CancellationToken cancellationToken)
    {
        var today = DateTime.UtcNow.Date;
        var count = await _charges.CountByDateAsync(today, cancellationToken);
        return $"RECIX-{today:yyyyMMdd}-{count + 1:D6}";
    }
}
