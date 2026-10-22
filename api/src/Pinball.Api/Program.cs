using Pinball.Modules.Catalog;
using Pinball.Modules.Sessions;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();
builder.Services.AddCatalogModule(builder.Configuration);
builder.Services.AddSessionsModule(builder.Configuration);

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.MapGet("/health", () => Results.Ok(new { status = "ok" }));

app.Run();

// Exposed for WebApplicationFactory in integration tests.
public partial class Program;
