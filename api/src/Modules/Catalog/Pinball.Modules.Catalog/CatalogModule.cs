using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Pinball.Modules.Catalog.Data;
using Pinball.Modules.Catalog.Opdb;
using Pinball.Modules.Catalog.Search;

namespace Pinball.Modules.Catalog;

public static class CatalogModule
{
    public static IServiceCollection AddCatalogModule(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddDbContext<CatalogDbContext>(options => options
            .UseNpgsql(
                configuration.GetConnectionString("Pinball"),
                npgsql => npgsql.MigrationsHistoryTable("__ef_migrations_history", CatalogDbContext.Schema))
            .UseSnakeCaseNamingConvention());

        services.Configure<OpdbImportOptions>(configuration.GetSection(OpdbImportOptions.Section));
        services.AddHttpClient<IOpdbExportSource, OpdbExportSource>(http => http.Timeout = TimeSpan.FromMinutes(2));
        services.AddScoped<CatalogImporter>();
        services.AddScoped<CatalogSearch>();
        services.AddScoped<CatalogMachines>();
        services.AddHostedService<OpdbImportWorker>();
        services.AddSingleton(TimeProvider.System);

        return services;
    }

    public static IEndpointRouteBuilder MapCatalogEndpoints(this IEndpointRouteBuilder app)
    {
        var catalog = app.MapGroup("/catalog").WithTags("Catalog");

        catalog.MapGet("/search", async (string? q, int? limit, CatalogSearch search, CancellationToken ct) =>
            {
                var query = q?.Trim() ?? "";
                if (query.Length is < CatalogSearch.MinQueryLength or > CatalogSearch.MaxQueryLength)
                {
                    return Results.ValidationProblem(new Dictionary<string, string[]>
                    {
                        ["q"] = [$"Must be {CatalogSearch.MinQueryLength}-{CatalogSearch.MaxQueryLength} characters."],
                    });
                }

                return Results.Ok(await search.SearchAsync(query, limit ?? 20, ct));
            })
            .WithName("SearchCatalog");

        // The phone's offline copy. Unchanged since the phone's copy → 304 with no body.
        catalog.MapGet("/machines", async (HttpContext http, CatalogMachines machines, CancellationToken ct) =>
            {
                var etag = $"\"catalog-{await machines.CurrentVersionAsync(ct)}\"";
                http.Response.Headers.ETag = etag;
                http.Response.Headers.CacheControl = "no-cache";

                if (http.Request.Headers.IfNoneMatch.Contains(etag))
                    return Results.StatusCode(StatusCodes.Status304NotModified);

                return Results.Ok(await machines.GetAsync(ct));
            })
            .WithName("CatalogMachines")
            .Produces<CatalogMachinesResponse>()
            .Produces(StatusCodes.Status304NotModified);

        return app;
    }
}
