namespace Recix.Application.Exceptions;

public sealed class DuplicateChargeReferenceException(string referenceId, Exception? inner = null)
    : Exception($"Charge with ReferenceId '{referenceId}' already exists.", inner)
{
    public string ReferenceId { get; } = referenceId;
}
