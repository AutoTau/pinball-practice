namespace Pinball.SharedKernel.Http;

/// <summary>Rate-limit policy names: the host defines the limits, modules opt their endpoints in by name.</summary>
public static class RateLimitPolicies
{
    /// <summary>Per signed-in user, for /sync (docs/api/sync.md promises 429 with Retry-After).</summary>
    public const string Sync = "sync";
}
