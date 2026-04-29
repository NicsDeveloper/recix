using System.Text.Json;
using Recix.Domain.Exceptions;

namespace Recix.Api.Middleware;

public sealed class ErrorHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ErrorHandlingMiddleware> _logger;
    private readonly IHostEnvironment _env;

    public ErrorHandlingMiddleware(RequestDelegate next, ILogger<ErrorHandlingMiddleware> logger, IHostEnvironment env)
    {
        _next = next;
        _logger = logger;
        _env = env;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (KeyNotFoundException ex)
        {
            await WriteJsonAsync(context, StatusCodes.Status404NotFound, "NotFound", ex.Message);
        }
        catch (ArgumentException ex)
        {
            await WriteJsonAsync(context, StatusCodes.Status400BadRequest, "ValidationError", ex.Message);
        }
        catch (DomainException ex)
        {
            await WriteJsonAsync(context, StatusCodes.Status400BadRequest, "DomainError", ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unhandled exception.");
            var detail = _env.IsDevelopment() ? ex.ToString() : null;
            await WriteJsonAsync(context, StatusCodes.Status500InternalServerError, "InternalServerError",
                "An unexpected error occurred.", detail);
        }
    }

    private static Task WriteJsonAsync(HttpContext context, int statusCode, string type, string title, string? detail = null)
    {
        context.Response.StatusCode = statusCode;
        context.Response.ContentType = "application/json";

        var body = new Dictionary<string, object?> { ["type"] = type, ["title"] = title };
        if (detail is not null) body["detail"] = detail;

        return context.Response.WriteAsync(JsonSerializer.Serialize(body,
            new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase }));
    }
}
