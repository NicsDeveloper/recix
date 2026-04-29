using Microsoft.OpenApi.Models;
using Recix.Api.Endpoints;
using Recix.Api.Middleware;
using Recix.Infrastructure.Extensions;

var builder = WebApplication.CreateBuilder(args);

// ─── CORS ─────────────────────────────────────────────────────────────────────
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader());
});

// ─── Infrastructure (inclui Auth + JWT + PIX provider) ───────────────────────
builder.Services.AddInfrastructure(builder.Configuration);

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
app.MapAuthEndpoints();     // /auth/* — AllowAnonymous internamente
app.MapChargeEndpoints();
app.MapWebhookEndpoints();  // /webhooks/* — AllowAnonymous internamente (PSP externo)
app.MapPaymentEventEndpoints();
app.MapReconciliationEndpoints();
app.MapDashboardEndpoints();
app.MapAiEndpoints();
app.MapEventEndpoints();

app.Run();
