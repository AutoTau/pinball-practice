using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Pinball.IntegrationTests;

// Guards the published contract: the OpenAPI document is the source the mobile app's types will be generated from.
public class OpenApiContractTests : IClassFixture<OpenApiContractTests.Api>
{
    private readonly HttpClient _client;

    public OpenApiContractTests(Api api) => _client = api.CreateClient();

    [Theory]
    [InlineData("/sync/push", "post")]
    [InlineData("/sync/pull", "get")]
    [InlineData("/catalog/search", "get")]
    public async Task OpenApi_documents_each_endpoint(string path, string method)
    {
        var doc = await _client.GetFromJsonAsync<JsonElement>("/openapi/v1.json");

        Assert.True(doc.GetProperty("paths").GetProperty(path).TryGetProperty(method, out _));
    }

    [Fact]
    public async Task OpenApi_documents_the_push_record_shapes_in_camelCase()
    {
        var schemas = (await _client.GetFromJsonAsync<JsonElement>("/openapi/v1.json"))
            .GetProperty("components").GetProperty("schemas");

        var ball = schemas.GetProperty("BallDto").GetProperty("properties");
        Assert.True(ball.TryGetProperty("cumulativeScore", out _));
        Assert.True(ball.TryGetProperty("updatedAt", out _));
        Assert.False(ball.TryGetProperty("userId", out _));
        Assert.True(schemas.GetProperty("PushRequest").GetProperty("properties").TryGetProperty("deviceId", out _));
    }

    [Fact]
    public async Task Sync_endpoints_require_sign_in()
    {
        var response = await _client.GetAsync("/sync/pull");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    public sealed class Api : WebApplicationFactory<Program>
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Development");
            builder.UseSetting("Catalog:Opdb:Enabled", "false");
        }
    }
}
