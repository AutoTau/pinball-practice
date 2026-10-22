using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Pinball.Modules.Sessions.Data;

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

        return services;
    }
}
