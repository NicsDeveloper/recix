namespace Recix.Domain.Enums;

public enum ReconciliationStatus
{
    Matched,
    AmountMismatch,
    DuplicatePayment,
    PaymentWithoutCharge,
    ExpiredChargePaid,
    InvalidReference,
    ProcessingError
}
