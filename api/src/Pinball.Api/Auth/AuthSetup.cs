using Microsoft.AspNetCore.Authentication.JwtBearer;

namespace Pinball.Api.Auth;

/// <summary>Bound from the <c>Auth</c> configuration section.</summary>
public sealed class AuthOptions
{
    public const string Section = "Auth";

    /// <summary>Token issuer, e.g. https://cognito-idp.us-west-2.amazonaws.com/us-west-2_AbC123.</summary>
    public string? Authority { get; set; }

    /// <summary>The app client the phone signs in with; access tokens carry it as <c>client_id</c>.</summary>
    public string? ClientId { get; set; }
}

/// <summary>
/// Validates Cognito access tokens as plain JWTs (decision 39). Nothing here is Cognito-specific beyond
/// the <c>client_id</c> and <c>token_use</c> checks, so another OIDC provider is a configuration change.
/// </summary>
public static class AuthSetup
{
    public static IServiceCollection AddPinballAuth(this IServiceCollection services, IConfiguration configuration)
    {
        var auth = configuration.GetSection(AuthOptions.Section).Get<AuthOptions>() ?? new AuthOptions();

        services
            .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(options =>
            {
                options.Authority = auth.Authority;
                options.MapInboundClaims = false; // keep "sub" as "sub"
                options.TokenValidationParameters.ValidateAudience = false; // Cognito access tokens have no aud
                options.TokenValidationParameters.NameClaimType = "sub";
                options.Events = new JwtBearerEvents
                {
                    OnTokenValidated = context =>
                    {
                        var principal = context.Principal!;
                        if (principal.FindFirst("token_use")?.Value is { } use && use != "access")
                            context.Fail("Only access tokens are accepted.");
                        else if (auth.ClientId is not null && principal.FindFirst("client_id")?.Value != auth.ClientId)
                            context.Fail("Token was issued to a different app client.");
                        return Task.CompletedTask;
                    },
                };
            });

        services.AddAuthorization();
        return services;
    }
}
