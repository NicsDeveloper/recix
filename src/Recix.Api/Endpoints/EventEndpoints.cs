using System.Text.Json;
using Recix.Application.Services;
using Recix.Application.Interfaces;

namespace Recix.Api.Endpoints;

public static class EventEndpoints
{
    public static void MapEventEndpoints(this WebApplication app)
    {
        app.MapGet("/events/metrics", (PaymentReliabilityMetrics metrics) => Results.Ok(metrics.Snapshot()))
            .WithTags("Events")
            .WithSummary("Métricas básicas de confiabilidade dos eventos de pagamento");

        app.MapGet("/events/stream", async (
            IEventBroadcaster broadcaster,
            HttpContext ctx,
            CancellationToken ct) =>
        {
            ctx.Response.Headers.ContentType  = "text/event-stream";
            ctx.Response.Headers.CacheControl = "no-cache";
            ctx.Response.Headers.Connection   = "keep-alive";
            // Necessário para que o nginx/proxy não bufferize o stream
            ctx.Response.Headers["X-Accel-Buffering"] = "no";

            // Heartbeat a cada 20s para manter a conexão viva através de proxies
            using var heartbeatTimer = new PeriodicTimer(TimeSpan.FromSeconds(20));
            var heartbeatTask = Task.Run(async () =>
            {
                try
                {
                    while (await heartbeatTimer.WaitForNextTickAsync(ct))
                    {
                        await ctx.Response.WriteAsync(": heartbeat\n\n", ct);
                        await ctx.Response.Body.FlushAsync(ct);
                    }
                }
                catch (OperationCanceledException) { }
            }, ct);

            try
            {
                await foreach (var evt in broadcaster.SubscribeAsync(ct))
                {
                    var json = JsonSerializer.Serialize(evt, new JsonSerializerOptions
                    {
                        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
                    });

                    await ctx.Response.WriteAsync($"data: {json}\n\n", ct);
                    await ctx.Response.Body.FlushAsync(ct);
                }
            }
            catch (OperationCanceledException)
            {
                // Cliente desconectou — normal
            }
            finally
            {
                await heartbeatTask;
            }
        })
        .WithTags("Events")
        .WithSummary("Server-Sent Events — stream de mudanças em tempo real");
    }
}
