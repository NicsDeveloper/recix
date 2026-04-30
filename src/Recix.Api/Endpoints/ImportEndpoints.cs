using Recix.Application.DTOs;
using Recix.Application.UseCases;

namespace Recix.Api.Endpoints;

public static class ImportEndpoints
{
    public static void MapImportEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/import").WithTags("Import");

        group.MapPost("/statement", ImportStatement)
            .WithName("ImportStatement")
            .WithSummary("Importa um extrato bancário em CSV e dispara a reconciliação de cada linha")
            .Accepts<IFormFile>("multipart/form-data")
            .Produces<ImportStatementResult>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status400BadRequest)
            .DisableAntiforgery();
    }

    private static async Task<IResult> ImportStatement(
        HttpRequest request,
        ImportBankStatementUseCase useCase,
        CancellationToken ct)
    {
        if (!request.HasFormContentType)
            return Results.BadRequest(new { error = "Envie o arquivo como multipart/form-data com o campo 'file'." });

        var form = await request.ReadFormAsync(ct);
        var file = form.Files.GetFile("file");

        if (file is null || file.Length == 0)
            return Results.BadRequest(new { error = "Arquivo não encontrado no campo 'file'." });

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (ext != ".csv")
            return Results.BadRequest(new { error = "Apenas arquivos .csv são suportados." });

        await using var stream = file.OpenReadStream();
        var result = await useCase.ExecuteAsync(stream, ct);
        return Results.Ok(result);
    }
}
