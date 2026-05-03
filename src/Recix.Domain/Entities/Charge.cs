using Recix.Domain.Enums;
using Recix.Domain.Exceptions;

namespace Recix.Domain.Entities;

public sealed class Charge
{
    public Guid Id             { get; private set; }
    public Guid OrganizationId { get; private set; }
    public string ReferenceId  { get; private set; } = default!;
    public string ExternalId   { get; private set; } = default!;
    public decimal Amount { get; private set; }
    public ChargeStatus Status { get; private set; }
    public DateTime ExpiresAt { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime? UpdatedAt { get; private set; }

    /// <summary>
    /// QR Code PIX (copia e cola) gerado pelo PSP.
    /// Null quando criado via FakePixProvider (ambiente de desenvolvimento).
    /// </summary>
    public string? PixCopiaECola { get; private set; }

    private Charge() { }

    public static Charge Create(Guid organizationId, string referenceId, string externalId, decimal amount, DateTime expiresAt)
    {
        if (amount <= 0)
            throw new DomainException("Charge amount must be greater than zero.");

        if (expiresAt <= DateTime.UtcNow)
            throw new DomainException("Charge expiration must be in the future.");

        return new Charge
        {
            Id             = Guid.NewGuid(),
            OrganizationId = organizationId,
            ReferenceId    = referenceId,
            ExternalId     = externalId,
            Amount         = amount,
            Status         = ChargeStatus.Pending,
            ExpiresAt      = expiresAt,
            CreatedAt      = DateTime.UtcNow,
        };
    }

    public void SetPixCopiaECola(string pixCopiaECola)
    {
        if (string.IsNullOrWhiteSpace(pixCopiaECola))
            throw new DomainException("PixCopiaECola cannot be empty.");
        PixCopiaECola = pixCopiaECola;
    }

    public bool IsExpired() => DateTime.UtcNow > ExpiresAt;

    public bool CanReceivePayment() =>
        Status is ChargeStatus.Pending or ChargeStatus.PartiallyPaid or ChargeStatus.Divergent;

    public void MarkAsPaid()
    {
        if (Status is not (
                ChargeStatus.Pending
                or ChargeStatus.PendingReview
                or ChargeStatus.Divergent
                or ChargeStatus.PartiallyPaid))
            throw new DomainException($"Cannot mark a {Status} charge as Paid.");

        Status    = ChargeStatus.Paid;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Registra recebimento parcial: há pagamentos vinculados, mas a soma ainda não cobre <see cref="Amount"/>.
    /// </summary>
    public void MarkAsPartiallyPaid()
    {
        if (Status is not (
                ChargeStatus.Pending
                or ChargeStatus.PartiallyPaid
                or ChargeStatus.Divergent))
            throw new DomainException($"Cannot mark a {Status} charge as PartiallyPaid.");

        Status    = ChargeStatus.PartiallyPaid;
        UpdatedAt = DateTime.UtcNow;
    }

    public void MarkAsDivergent()
    {
        if (Status is not (
                ChargeStatus.Pending
                or ChargeStatus.Expired
                or ChargeStatus.PendingReview
                or ChargeStatus.PartiallyPaid))
            throw new DomainException($"Cannot mark a {Status} charge as Divergent.");

        Status    = ChargeStatus.Divergent;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>A soma dos pagamentos vinculados superou o valor esperado da cobrança.</summary>
    public void MarkAsOverpaid()
    {
        if (Status is not (ChargeStatus.Pending or ChargeStatus.PartiallyPaid))
            throw new DomainException($"Cannot mark a {Status} charge as Overpaid.");

        Status    = ChargeStatus.Overpaid;
        UpdatedAt = DateTime.UtcNow;
    }

    public void MarkAsExpired()
    {
        if (Status != ChargeStatus.Pending)
            throw new DomainException($"Cannot mark a {Status} charge as Expired.");

        Status    = ChargeStatus.Expired;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Reserva a cobrança para um match de baixa confiança que aguarda revisão humana.
    /// Impede que o fuzzy matching a reutilize enquanto está em análise.
    /// </summary>
    public void MarkAsPendingReview()
    {
        if (Status != ChargeStatus.Pending)
            throw new DomainException($"Cannot put a {Status} charge in PendingReview.");

        Status    = ChargeStatus.PendingReview;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>Usuário rejeitou o match — a cobrança volta a Pending para novo matching.</summary>
    public void RevertToPending()
    {
        if (Status != ChargeStatus.PendingReview)
            throw new DomainException($"Cannot revert a {Status} charge to Pending.");

        Status    = ChargeStatus.Pending;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>Cancelamento manual — apenas enquanto não há pagamento vinculado.</summary>
    public void Cancel()
    {
        if (Status != ChargeStatus.Pending)
            throw new DomainException(
                "Só é possível cancelar cobranças ainda pendentes (sem pagamento registrado).");

        Status    = ChargeStatus.Cancelled;
        UpdatedAt = DateTime.UtcNow;
    }
}
