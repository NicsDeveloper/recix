using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.OpenApi.Models;
using Recix.Api.BackgroundServices;
using Recix.Api.Endpoints;
using Recix.Api.Hubs;
using Recix.Api.Middleware;
using Recix.Infrastructure.Extensions;

var builder = WebApplication.CreateBuilder(args);

// ─── CORS ─────────────────────────────────────────────────────────────────────
// SignalR WebSocket exige AllowCredentials + WithOrigins (não AllowAnyOrigin)
var frontendOrigins = builder.Configuration
    .GetSection("AllowedOrigins").Get<string[]>()
    ?? ["http://localhost:5173", "http://localhost:3000"];

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy.WithOrigins(frontendOrigins)
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials());
});

// ─── Infrastructure (inclui Auth + JWT + PIX provider) ───────────────────────
builder.Services.AddInfrastructure(builder.Configuration);

// ─── SignalR ──────────────────────────────────────────────────────────────────
builder.Services.AddSignalR(opts => opts.EnableDetailedErrors = builder.Environment.IsDevelopment());
builder.Services.AddHostedService<SignalRBridgeService>();

// ─── Swagger ──────────────────────────────────────────────────────────────────
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new()
    {
        Title       = "RECIX Engine API",
        Version     = "v1",
        Description = "Engine de processamento financeiro em tempo real — PIX fake, conciliação e auditoria.",
    });

    // Suporte a JWT no Swagger UI
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name         = "Authorization",
        Type         = SecuritySchemeType.Http,
        Scheme       = "bearer",
        BearerFormat = "JWT",
        In           = ParameterLocation.Header,
        Description  = "Informe o token JWT. Exemplo: Bearer {seu token}",
    });
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
            },
            Array.Empty<string>()
        }
    });
});

var app = builder.Build();

// ─── Middleware ───────────────────────────────────────────────────────────────
app.UseMiddleware<ErrorHandlingMiddleware>();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

// ─── Dev only ─────────────────────────────────────────────────────────────────
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c => c.SwaggerEndpoint("/swagger/v1/swagger.json", "RECIX Engine v1"));
    await app.Services.MigrateAsync();
}

// ─── Endpoints ────────────────────────────────────────────────────────────────
// Política de fallback (AddAuthorizationBuilder) já exige auth em tudo.
// Endpoints públicos usam .AllowAnonymous() internamente.
app.MapAuthEndpoints();         // /auth/* — AllowAnonymous internamente
app.MapOrganizationEndpoints(); // /organizations/*
app.MapChargeEndpoints();
app.MapWebhookEndpoints();  // /webhooks/* — AllowAnonymous internamente (PSP externo)
app.MapPaymentEventEndpoints();
app.MapReconciliationEndpoints();
app.MapDashboardEndpoints();
app.MapImportEndpoints();
app.MapAlertConfigEndpoints();
app.MapAiEndpoints();
app.MapEventEndpoints();
app.MapHub<DashboardHub>("/hubs/dashboard").AllowAnonymous(); // auth via JWT query string

app.Run();
