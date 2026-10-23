using System.Net.Http.Headers;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace Pinball.IntegrationTests;

/// <summary>
/// The real API on the test Postgres, with JWTs signed by a test key in place of Cognito. Tokens look like
/// Cognito access tokens: sub, client_id and token_use.
/// </summary>
public sealed class SyncApi(PostgresFixture db) : WebApplicationFactory<Program>
{
    public const string ClientId = "test-client";
    private const string Issuer = "https://issuer.test";
    private static readonly SymmetricSecurityKey Key = new(Encoding.UTF8.GetBytes(new string('k', 64)));

    /// <summary>Extra configuration, applied after the defaults (e.g. a tiny rate limit for one test).</summary>
    public Dictionary<string, string> Settings { get; init; } = [];

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.UseSetting("ConnectionStrings:Pinball", db.ConnectionString);
        builder.UseSetting("Catalog:Opdb:Enabled", "false");
        builder.UseSetting("Auth:ClientId", ClientId);
        foreach (var (key, value) in Settings) builder.UseSetting(key, value);

        builder.ConfigureServices(services =>
            services.PostConfigure<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme, options =>
            {
                options.Authority = null;
                options.TokenValidationParameters.ValidIssuer = Issuer;
                options.TokenValidationParameters.IssuerSigningKey = Key;
            }));
    }

    /// <summary>A client signed in as <paramref name="subject"/>.</summary>
    public HttpClient ClientFor(string subject, string clientId = ClientId, string tokenUse = "access")
    {
        var token = new JsonWebTokenHandler().CreateToken(new SecurityTokenDescriptor
        {
            Issuer = Issuer,
            Subject = new ClaimsIdentity([new("sub", subject), new("client_id", clientId), new("token_use", tokenUse)]),
            Expires = DateTime.UtcNow.AddHours(1),
            SigningCredentials = new SigningCredentials(Key, SecurityAlgorithms.HmacSha256),
        });

        var client = CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }
}
