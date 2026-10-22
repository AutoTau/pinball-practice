using NetArchTest.Rules;
using Pinball.Modules.Catalog;
using Pinball.Modules.Sessions;
using Pinball.SharedKernel.Sync;

namespace Pinball.Architecture.Tests;

// Module boundaries are enforced in code, not by convention (plan: Architecture).
public class ModuleBoundaryTests
{
    private const string Catalog = "Pinball.Modules.Catalog";
    private const string Sessions = "Pinball.Modules.Sessions";

    [Fact]
    public void Catalog_does_not_depend_on_other_modules()
    {
        var result = Types.InAssembly(typeof(CatalogModule).Assembly)
            .ShouldNot().HaveDependencyOn(Sessions)
            .GetResult();

        Assert.True(result.IsSuccessful, Describe(result));
    }

    [Fact]
    public void Sessions_does_not_depend_on_other_modules()
    {
        var result = Types.InAssembly(typeof(SessionsModule).Assembly)
            .ShouldNot().HaveDependencyOn(Catalog)
            .GetResult();

        Assert.True(result.IsSuccessful, Describe(result));
    }

    [Fact]
    public void SharedKernel_does_not_depend_on_modules()
    {
        var result = Types.InAssembly(typeof(SyncEntity).Assembly)
            .ShouldNot().HaveDependencyOnAny(Catalog, Sessions, "Pinball.Api")
            .GetResult();

        Assert.True(result.IsSuccessful, Describe(result));
    }

    private static string Describe(TestResult result) =>
        "Offending types: " + string.Join(", ", result.FailingTypeNames ?? []);
}
