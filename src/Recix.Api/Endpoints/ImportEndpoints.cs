using Recix.Application.DTOs;
using Recix.Application.UseCases;

namespace Recix.Api.Endpoints;

public static class ImportEndpoints
{
    public static void MapImportEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/import").WithTags("Import");

        // ── Preview (valida sem persistir) ─────────────────────────────────────────

        group.MapPost("/preview/sales", PreviewSales)
            .WithName("PreviewSalesImport")
            .WithSummary("Valida CSV de vendas e retorna preview sem persistir nada")
            .Accepts<IFormFile>("multipart/form-data")
            .Produces<ImportPreviewResult>()
            .Produces(StatusCodes.Status400BadRequest)
            .DisableAntiforgery();

        group.MapPost("/preview/statement", PreviewStatement)
            .WithName("PreviewStatementImport")
            .WithSummary("Valida CSV/OFX de extrato e retorna preview sem persistir nada")
            .Accepts<IFormFile>("multipart/form-data")
            .Produces<ImportPreviewResult>()
            .Produces(StatusCodes.Status400BadRequest)
            .DisableAntiforgery();

        // ── Importação real ────────────────────────────────────────────────────────

        group.MapPost("/statement", ImportStatement)
            .WithName("ImportStatement")
            .WithSummary("Importa extrato bancário em CSV ou OFX e reconcilia automaticamente")
            .Accepts<IFormFile>("multipart/form-data")
            .Produces<ImportStatementResult>()
            .Produces(StatusCodes.Status400BadRequest)
            .DisableAntiforgery();

        group.MapPost("/sales", ImportSales)
            .WithName("ImportSales")
            .WithSummary("Importa vendas em CSV e cria cobranças para cada linha")
            .Accepts<IFormFile>("multipart/form-data")
            .Produces<ImportSalesResult>()
            .Produces(StatusCodes.Status400BadRequest)
            .DisableAntiforgery();
    }

    // ── Preview handlers ──────────────────────────────────────────────────────────

    private static async Task<IResult> PreviewSales(
        HttpRequest request,
        ImportPreviewUseCase useCase,
        CancellationToken ct)
    {
        var (file, error) = await GetFile(request, ct);
        if (file is null) return error!;

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (ext != ".csv")
            return Results.BadRequest(new { error = "Apenas arquivos .csv são suportados para vendas." });

        await using var stream = file.OpenReadStream();
        var result = await useCase.PreviewSalesAsync(stream, file.FileName, ct);
        return Results.Ok(result);
    }

    private static async Task<IResult> PreviewStatement(
        HttpRequest request,
        ImportPreviewUseCase useCase,
        CancellationToken ct)
    {
        var (file, error) = await GetFile(request, ct);
        if (file is null) return error!;

        var ext   = Path.GetExtension(file.FileName).ToLowerInvariant();
        bool isOfx = ext is ".ofx" or ".ofc";
        bool isCsv = ext == ".csv";

        if (!isOfx && !isCsv)
            return Results.BadRequest(new { error = "Formato não suportado. Envie .csv ou .ofx." });

        await using var stream = file.OpenReadStream();
        var result = await useCase.PreviewStatementAsync(stream, file.FileName, isOfx, ct);
        return Results.Ok(result);
    }

    // ── Import handlers ───────────────────────────────────────────────────────────

    private static async Task<IResult> ImportStatement(
        HttpRequest request,
        ImportBankStatementUseCase useCase,
        CancellationToken ct)
    {
        var (file, error) = await GetFile(request, ct);
        if (file is null) return error!;

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();

        if (ext is ".ofx" or ".ofc")
        {
            await using var stream = file.OpenReadStream();
            return Results.Ok(await useCase.ExecuteFromOFXAsync(stream, ct));
        }

        if (ext == ".csv")
        {
            await using var stream = file.OpenReadStream();
            return Results.Ok(await useCase.ExecuteAsync(stream, ct));
        }

        return Results.BadRequest(new { error = "Formato não suportado. Envie .csv ou .ofx." });
    }

    private static async Task<IResult> ImportSales(
        HttpRequest request,
        ImportSalesUseCase useCase,
        CancellationToken ct)
    {
        var (file, error) = await GetFile(request, ct);
        if (file is null) return error!;

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (ext != ".csv")
            return Results.BadRequest(new { error = "Apenas arquivos .csv são suportados para vendas." });

        await using var stream = file.OpenReadStream();
        return Results.Ok(await useCase.ExecuteAsync(stream, ct));
    }

    // ── Helper ────────────────────────────────────────────────────────────────────

    private static async Task<(IFormFile? File, IResult? Error)> GetFile(HttpRequest request, CancellationToken ct)
    {
        if (!request.HasFormContentType)
            return (null, Results.BadRequest(new { error = "Envie o arquivo como multipart/form-data com o campo 'file'." }));

        var form = await request.ReadFormAsync(ct);
        var file = form.Files.GetFile("file");

        if (file is null || file.Length == 0)
            return (null, Results.BadRequest(new { error = "Arquivo não encontrado no campo 'file'." }));

        return (file, null);
    }
}
