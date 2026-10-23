using System.Buffers.Text;
using System.Text;
using System.Text.Json;

namespace Pinball.Modules.Sessions.Sync;

/// <summary>
/// A position in the pull order (transaction ID, table rank, row ID), opaque to clients (decision 32).
/// Serialized as base64url JSON; the transaction ID travels as a string because xid8 exceeds JSON's safe integers.
/// </summary>
public sealed record SyncCursor(ulong Xid, int Table, Guid Id)
{
    /// <summary>Before everything: a device's first pull.</summary>
    public static readonly SyncCursor Start = new(0, -1, Guid.Empty);

    private sealed record Wire(string X, int T, Guid I);

    public string Encode() =>
        Base64Url.EncodeToString(JsonSerializer.SerializeToUtf8Bytes(new Wire(Xid.ToString(), Table, Id)));

    public static bool TryDecode(string? text, out SyncCursor cursor)
    {
        cursor = Start;
        if (string.IsNullOrEmpty(text)) return true;

        try
        {
            var wire = JsonSerializer.Deserialize<Wire>(Base64Url.DecodeFromChars(text));
            if (wire is null || !ulong.TryParse(wire.X, out var xid) || wire.T is < -1 or > 4) return false;
            cursor = new SyncCursor(xid, wire.T, wire.I);
            return true;
        }
        catch (Exception e) when (e is FormatException or JsonException)
        {
            return false;
        }
    }
}
