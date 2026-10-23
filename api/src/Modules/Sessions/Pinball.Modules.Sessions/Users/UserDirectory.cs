using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Pinball.Modules.Sessions.Data;

namespace Pinball.Modules.Sessions.Users;

/// <summary>Maps a signed-in identity to the internal user ID, creating the user on first sign-in.</summary>
public sealed class UserDirectory(PracticeDbContext db, TimeProvider clock)
{
    public async Task<Guid> ResolveAsync(ClaimsPrincipal principal, CancellationToken ct)
    {
        var subject = principal.FindFirst("sub")?.Value
            ?? throw new InvalidOperationException("Authenticated principal has no sub claim.");

        // Insert-if-missing in one statement so two first requests racing can't create two users.
        await db.Database.ExecuteSqlAsync($"""
            INSERT INTO practice.users (id, auth_subject, created_at)
            VALUES ({Guid.NewGuid()}, {subject}, {clock.GetUtcNow()})
            ON CONFLICT (auth_subject) DO NOTHING
            """, ct);

        return await db.Users.Where(u => u.AuthSubject == subject).Select(u => u.Id).SingleAsync(ct);
    }
}
