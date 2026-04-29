using Recix.Api.Endpoints;
using Recix.Api.Middleware;
using Recix.Infrastructure.Extensions;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new()
    {
        Title = "RECIX Engine API",
        Version = "v1",
        Description = "Engine de processamento financeiro em tempo real — PIX fake, conciliação e auditoria."
    });
});

var app = builder.Build();

app.UseMiddleware<ErrorHandlingMiddleware>();
app.UseCors();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c => c.SwaggerEndpoint("/swagger/v1/swagger.json", "RECIX Engine v1"));
    await app.Services.MigrateAsync();
}

app.MapChargeEndpoints();
app.MapWebhookEndpoints();
app.MapPaymentEventEndpoints();
app.MapReconciliationEndpoints();
app.MapDashboardEndpoints();
app.MapAiEndpoints();
app.MapEventEndpoints();

app.Run();
