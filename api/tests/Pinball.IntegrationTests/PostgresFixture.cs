using Microsoft.EntityFrameworkCore;
using Pinball.Modules.Catalog.Data;
using Pinball.Modules.Sessions.Data;
using Testcontainers.PostgreSql;

namespace Pinball.IntegrationTests;

/// <summary>Starts one Postgres container per test run and applies every module's migrations.</summary>
public sealed class PostgresFixture : IAsyncLifetime
{
    private readonly PostgreSqlContainer _container = new PostgreSqlBuilder("postgres:17-alpine").Build();

    public string ConnectionString => _container.GetConnectionString();

    public async Task InitializeAsync()
    {
        await _container.StartAsync();

        await using (var catalog = CreateCatalog())
        {
            await catalog.Database.MigrateAsync();
        }

        await using var practice = CreatePractice();
        await practice.Database.MigrateAsync();
    }

    public Task DisposeAsync() => _container.DisposeAsync().AsTask();

    public CatalogDbContext CreateCatalog() => new(new DbContextOptionsBuilder<CatalogDbContext>()
        .UseNpgsql(ConnectionString, o => o.MigrationsHistoryTable("__ef_migrations_history", CatalogDbContext.Schema))
        .UseSnakeCaseNamingConvention()
        .Options);

    public PracticeDbContext CreatePractice() => new(new DbContextOptionsBuilder<PracticeDbContext>()
        .UseNpgsql(ConnectionString, o => o.MigrationsHistoryTable("__ef_migrations_history", PracticeDbContext.Schema))
        .UseSnakeCaseNamingConvention()
        .Options);
}

[CollectionDefinition(Name)]
public class PostgresCollection : ICollectionFixture<PostgresFixture>
{
    public const string Name = "postgres";
}
