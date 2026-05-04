using Microsoft.Extensions.Logging;
using Recix.Application.DTOs;
using Recix.Application.Exceptions;
using Recix.Application.Interfaces;
using Recix.Domain.Entities;

namespace Recix.Application.UseCases;

public sealed class CreateChargeUseCase
{
    private readonly IChargeRepository _charges;
    private readonly IPixProvider _pixProvider;
    private readonly ILogger<CreateChargeUseCase> _logger;

    private readonly ICurrentOrganization _currentOrg;

    private readonly IEventBroadcaster _broadcaster;

    public CreateChargeUseCase(
        IChargeRepository charges,
        IPixProvider pixProvider,
        ICurrentOrganization currentOrg,
        IEventBroadcaster broadcaster,
        ILogger<CreateChargeUseCase> logger)
    {
        _charges     = charges;
        _pixProvider = pixProvider;
        _currentOrg  = currentOrg;
        _broadcaster = broadcaster;
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

        var expiresAt = DateTime.UtcNow.AddMinutes(request.ExpiresInMinutes);

        const int maxAttempts = 5;
        for (var attempt = 0; attempt < maxAttempts; attempt++)
        {
            var referenceId = await GenerateReferenceIdAsync(cancellationToken);
            var pixResult   = await _pixProvider.CreateChargeAsync(referenceId, request.Amount, expiresAt, cancellationToken);
            var charge      = Charge.Create(orgId, referenceId, pixResult.TxId, request.Amount, expiresAt);
            charge.SetPixCopiaECola(pixResult.PixCopiaECola);

            try
            {
                await _charges.AddAsync(charge, cancellationToken);
            }
            catch (DuplicateChargeReferenceException) when (attempt < maxAttempts - 1)
            {
                _logger.LogWarning(
                    "ReferenceId collision on attempt {Attempt}: {ReferenceId}. Retrying.",
                    attempt + 1, referenceId);
                continue;
            }

            _broadcaster.Publish(RecixEvent.ChargeUpdated(charge.Id, orgId));
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

        throw new InvalidOperationException("Não foi possível gerar um ReferenceId único após múltiplas tentativas.");
    }

    private async Task<string> GenerateReferenceIdAsync(CancellationToken cancellationToken)
    {
        var today = DateTime.UtcNow.Date;
        var count = await _charges.CountByDateAsync(today, cancellationToken);
        return $"RECIX-{today:yyyyMMdd}-{count + 1:D6}";
    }
}
