using Pinball.Api;
using Pinball.Api.Auth;
using Pinball.Modules.Catalog;
using Pinball.Modules.Catalog.Data;
using Pinball.Modules.Sessions;
using Pinball.Modules.Sessions.Data;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();
// JSON compresses well; the phone's catalog download drops to about a fifth of its raw size.
builder.Services.AddResponseCompression(options => options.EnableForHttps = true);
builder.Services.AddPinballAuth(builder.Configuration);
builder.Services.AddPinballRateLimits(builder.Configuration);
builder.Services.AddCatalogModule(builder.Configuration);
builder.Services.AddSessionsModule(builder.Configuration);

// Healthy only when each module's database is reachable, so a container host can replace a broken instance.
builder.Services.AddHealthChecks()
    .AddDbContextCheck<CatalogDbContext>("catalog-db")
    .AddDbContextCheck<PracticeDbContext>("practice-db");

var app = builder.Build();

app.UseResponseCompression();
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.MapHealthChecks("/health");
app.MapCatalogEndpoints();
app.MapSessionsEndpoints();

app.Run();

// Exposed for WebApplicationFactory in integration tests.
public partial class Program;
