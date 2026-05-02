namespace Recix.Application.DTOs;

/// <summary>Status de validação de uma linha do arquivo antes da importação.</summary>
public enum LineValidationStatus
{
    /// <summary>Linha válida — será importada normalmente.</summary>
    Ok,

    /// <summary>Linha com aviso — será importada mas pode causar divergência.</summary>
    Warning,

    /// <summary>Linha com erro bloqueante — será descartada na importação.</summary>
    Error,
}

public sealed class ImportPreviewLine
{
    public int                   LineNumber  { get; init; }
    public LineValidationStatus  Status      { get; init; }
    public string?               Message     { get; init; }

    // Campos extraídos para exibição na tabela de preview
    public string?  EventId     { get; init; }
    public decimal? Amount      { get; init; }
    public string?  Date        { get; init; }
    public string?  Description { get; init; }
    public string?  Reference   { get; init; }
    public string?  Provider    { get; init; }
}

public sealed class ImportPreviewResult
{
    public ImportType  Type          { get; init; }
    public string      FileName      { get; init; } = "";
    public int         TotalLines    { get; init; }
    public int         ValidLines    { get; init; }
    public int         WarningLines  { get; init; }
    public int         ErrorLines    { get; init; }

    /// <summary>Verdadeiro se há erros bloqueantes que impedem a importação.</summary>
    public bool HasBlockingErrors => ErrorLines > 0 && ValidLines == 0;

    /// <summary>Colunas detectadas automaticamente (para informar ao usuário).</summary>
    public IReadOnlyList<string> DetectedColumns { get; init; } = [];

    public IReadOnlyList<ImportPreviewLine> Lines { get; init; } = [];
}

public enum ImportType { Sales, BankStatement }
