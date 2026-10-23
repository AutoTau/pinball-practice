using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Pinball.Modules.Catalog.Data;
using Pinball.Modules.Catalog.Domain;

namespace Pinball.Modules.Catalog.Opdb;

/// <summary>
/// Wakes every <see cref="OpdbImportOptions.CheckInterval"/> and imports when the last attempt is older than
/// <see cref="OpdbImportOptions.RefreshInterval"/>. Failed attempts don't count, so they retry on the next check;
/// rejected files wait a full day for OPDB to publish a new one.
/// </summary>
public sealed class OpdbImportWorker(
    IServiceScopeFactory scopes,
    IOptions<OpdbImportOptions> options,
    TimeProvider clock,
    ILogger<OpdbImportWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!options.Value.Enabled)
        {
            logger.LogInformation("OPDB import disabled");
            return;
        }

        using var timer = new PeriodicTimer(options.Value.CheckInterval, clock);
        do
        {
            try
            {
                await using var scope = scopes.CreateAsyncScope();
                var db = scope.ServiceProvider.GetRequiredService<CatalogDbContext>();

                var lastAttempt = await db.OpdbImports
                    .Where(i => i.Outcome != OpdbImportOutcome.Failed && i.Outcome != OpdbImportOutcome.Running)
                    .MaxAsync(i => (DateTimeOffset?)i.StartedAt, stoppingToken);

                if (lastAttempt is null || clock.GetUtcNow() - lastAttempt >= options.Value.RefreshInterval)
                    await scope.ServiceProvider.GetRequiredService<CatalogImporter>().ImportAsync(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                // e.g. the database is down; try again on the next tick.
                logger.LogError(ex, "OPDB import check failed");
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}
