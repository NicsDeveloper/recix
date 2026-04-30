namespace Recix.Domain.Entities;

/// <summary>
/// Configuração de alertas proativos por organização.
/// Quando uma divergência é detectada, o RECIX dispara um webhook para a URL configurada.
/// </summary>
public sealed class OrgAlertConfig
{
    public Guid   OrganizationId           { get; private set; }
    public string? WebhookUrl              { get; private set; }
    public bool   NotifyAmountMismatch     { get; private set; }
    public bool   NotifyDuplicatePayment   { get; private set; }
    public bool   NotifyPaymentWithoutCharge { get; private set; }
    public bool   NotifyExpiredChargePaid  { get; private set; }
    public DateTime UpdatedAt             { get; private set; }

    private OrgAlertConfig() { }

    public static OrgAlertConfig Create(Guid orgId) => new()
    {
        OrganizationId            = orgId,
        NotifyAmountMismatch      = true,
        NotifyDuplicatePayment    = true,
        NotifyPaymentWithoutCharge = true,
        NotifyExpiredChargePaid   = true,
        UpdatedAt                 = DateTime.UtcNow,
    };

    public void Update(
        string? webhookUrl,
        bool notifyAmountMismatch,
        bool notifyDuplicatePayment,
        bool notifyPaymentWithoutCharge,
        bool notifyExpiredChargePaid)
    {
        WebhookUrl                 = string.IsNullOrWhiteSpace(webhookUrl) ? null : webhookUrl.Trim();
        NotifyAmountMismatch       = notifyAmountMismatch;
        NotifyDuplicatePayment     = notifyDuplicatePayment;
        NotifyPaymentWithoutCharge = notifyPaymentWithoutCharge;
        NotifyExpiredChargePaid    = notifyExpiredChargePaid;
        UpdatedAt                  = DateTime.UtcNow;
    }
}
