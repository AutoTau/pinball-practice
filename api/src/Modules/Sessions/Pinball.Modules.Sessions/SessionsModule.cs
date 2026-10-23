using System.Security.Claims;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Pinball.Modules.Sessions.Data;
using Pinball.Modules.Sessions.Sync;
using Pinball.Modules.Sessions.Users;
using Pinball.SharedKernel.Http;

namespace Pinball.Modules.Sessions;

public static class SessionsModule
{
    public static IServiceCollection AddSessionsModule(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddDbContext<PracticeDbContext>(options => options
            .UseNpgsql(
                configuration.GetConnectionString("Pinball"),
                npgsql => npgsql.MigrationsHistoryTable("__ef_migrations_history", PracticeDbContext.Schema))
            .UseSnakeCaseNamingConvention());

        services.TryAddTimeProvider();
        services.AddScoped<UserDirectory>();
        services.AddScoped<SyncService>();
        return services;
    }

    /// <summary>The sync contract (docs/api/sync.md). Every endpoint needs a signed-in user.</summary>
    public static IEndpointRouteBuilder MapSessionsEndpoints(this IEndpointRouteBuilder app)
    {
        var sync = app.MapGroup("/sync").WithTags("Sync").RequireAuthorization().RequireRateLimiting(RateLimitPolicies.Sync);

        sync.MapPost("/push", async (PushRequest request, ClaimsPrincipal user, UserDirectory users, SyncService service, CancellationToken ct) =>
            {
                if (request.Count > SyncLimits.MaxPushRecords)
                {
                    return Results.Problem(
                        statusCode: StatusCodes.Status413PayloadTooLarge,
                        title: $"A push may carry at most {SyncLimits.MaxPushRecords} records.");
                }

                var userId = await users.ResolveAsync(user, ct);
                return Results.Ok(await service.PushAsync(userId, request, ct));
            })
            .WithName("SyncPush")
            .WithSummary("Upload records changed on the device; returns a result per record.")
            .Produces<PushResponse>()
            .ProducesValidationProblem()
            .ProducesProblem(StatusCodes.Status401Unauthorized)
            .ProducesProblem(StatusCodes.Status413PayloadTooLarge)
            .ProducesProblem(StatusCodes.Status429TooManyRequests);

        sync.MapGet("/pull", async (string? cursor, int? limit, ClaimsPrincipal user, UserDirectory users, SyncService service, CancellationToken ct) =>
            {
                if (!SyncCursor.TryDecode(cursor, out var after))
                {
                    return Results.ValidationProblem(new Dictionary<string, string[]>
                    {
                        ["cursor"] = ["Not a cursor this server issued. Send back the cursor from the last pull unchanged."],
                    });
                }

                var userId = await users.ResolveAsync(user, ct);
                return Results.Ok(await service.PullAsync(userId, after, limit ?? SyncLimits.DefaultPullLimit, ct));
            })
            .WithName("SyncPull")
            .WithSummary("Download records changed since the cursor, one page at a time.")
            .Produces<PullResponse>()
            .ProducesValidationProblem()
            .ProducesProblem(StatusCodes.Status401Unauthorized)
            .ProducesProblem(StatusCodes.Status429TooManyRequests);

        return app;
    }

    private static void TryAddTimeProvider(this IServiceCollection services)
    {
        if (services.All(s => s.ServiceType != typeof(TimeProvider)))
            services.AddSingleton(TimeProvider.System);
    }
}
