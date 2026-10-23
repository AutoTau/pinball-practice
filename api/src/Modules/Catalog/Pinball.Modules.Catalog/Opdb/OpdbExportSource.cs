using System.Net;
using Microsoft.Extensions.Options;

namespace Pinball.Modules.Catalog.Opdb;

/// <summary>A downloaded export, or null <see cref="Content"/> when unchanged since the last import.</summary>
public sealed record OpdbDownload(Stream? Content, DateTimeOffset? LastModified) : IAsyncDisposable
{
    public bool NotModified => Content is null;

    public ValueTask DisposeAsync() => Content?.DisposeAsync() ?? ValueTask.CompletedTask;
}

public interface IOpdbExportSource
{
    Task<OpdbDownload> DownloadAsync(DateTimeOffset? ifModifiedSince, CancellationToken ct);
}

/// <summary>Fetches OPDB's daily export from the Match Play CDN (decision 27).</summary>
public sealed class OpdbExportSource(HttpClient http, IOptions<OpdbImportOptions> options) : IOpdbExportSource
{
    public async Task<OpdbDownload> DownloadAsync(DateTimeOffset? ifModifiedSince, CancellationToken ct)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, options.Value.ExportUrl);
        request.Headers.IfModifiedSince = ifModifiedSince;

        var response = await http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, ct);
        if (response.StatusCode == HttpStatusCode.NotModified)
        {
            response.Dispose();
            return new OpdbDownload(null, ifModifiedSince);
        }

        response.EnsureSuccessStatusCode();

        // Buffer the file so a dropped connection fails here rather than halfway through parsing.
        var buffer = new MemoryStream();
        await using (var body = await response.Content.ReadAsStreamAsync(ct))
        {
            await body.CopyToAsync(buffer, ct);
        }

        var expected = response.Content.Headers.ContentLength;
        if (expected is not null && buffer.Length != expected)
            throw new IOException($"OPDB export truncated: got {buffer.Length} of {expected} bytes.");

        buffer.Position = 0;
        return new OpdbDownload(buffer, response.Content.Headers.LastModified);
    }
}
