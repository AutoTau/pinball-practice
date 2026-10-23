using System.Text;
using Pinball.Modules.Catalog.Opdb;
using static Pinball.Modules.Catalog.Tests.OpdbSamples;

namespace Pinball.Modules.Catalog.Tests;

public class OpdbExportTests
{
    [Fact]
    public void Maps_groups_machines_and_aliases_to_their_tables()
    {
        var s = OpdbExport.Map(Godzilla());

        Assert.Equal("GweeP", Assert.Single(s.Groups).OpdbGroupId);
        Assert.Equal(["GweeP-MW95j", "GweeP-Ml9pZ"], s.Editions.Select(e => e.OpdbMachineId));
        Assert.All(s.Aliases, a => Assert.Equal("GweeP-Ml9pZ", a.OpdbMachineId));
        Assert.False(s.Editions.Single(e => e.OpdbMachineId == "GweeP-Ml9pZ").PhysicalMachine);
        Assert.Empty(s.Invalid);
    }

    [Fact]
    public void Copies_manufacturer_display_and_rulesheet_fields()
    {
        var entries = Godzilla();
        entries[1] = entries[1] with { PinballRulesUrl = "https://example.test/gz" };

        var pro = OpdbExport.Map(entries).Editions[0];

        Assert.Equal("Stern", pro.Manufacturer);
        Assert.Equal("lcd", pro.Display);
        Assert.Equal((short)2021, pro.Year);
        Assert.Equal("https://example.test/gz", pro.PinballRulesUrl);
    }

    [Fact]
    public void Picks_the_primary_backglass_for_display_art()
    {
        static OpdbImage Img(string type, bool primary, string name) =>
            new(type, primary, new OpdbImageUrls($"https://img.test/{name}-small.jpg", $"https://img.test/{name}-medium.jpg", null));

        var entries = Godzilla();
        entries[1] = entries[1] with
        {
            Images = [Img("playfield", true, "pf"), Img("backglass", false, "bg-alt"), Img("backglass", true, "bg")],
        };
        entries[3] = entries[3] with { Images = [Img("cabinet", false, "cab")] };

        var s = OpdbExport.Map(entries);

        Assert.Equal("https://img.test/bg-small.jpg", s.Editions[0].ImageSmallUrl);
        Assert.Equal("https://img.test/bg-medium.jpg", s.Editions[0].ImageMediumUrl);
        Assert.Equal("https://img.test/cab-small.jpg", s.Aliases[0].ImageSmallUrl); // no backglass: any image
        Assert.Null(s.Editions[1].ImageSmallUrl); // no images at all
    }

    [Theory]
    [InlineData(null, "missing opdbId")]
    [InlineData("not-an-id", "malformed opdbId")]
    [InlineData("GweeP-MW95j-A1", "machine id doesn't match type")]
    [InlineData("GxXxX-MW95j", "machine outside its group")]
    public void Rejects_malformed_machine_entries(string? id, string reason)
    {
        var entries = Godzilla();
        entries[1] = entries[1] with { OpdbId = id };

        var s = OpdbExport.Map(entries);

        Assert.Contains(s.Invalid, i => i.EndsWith(reason, StringComparison.Ordinal));
    }

    [Fact]
    public void Rejects_unknown_entry_types_and_implausible_years()
    {
        var entries = Godzilla();
        entries[1] = entries[1] with { EntryType = "spaceship" };
        entries[3] = entries[3] with { Year = 30000 };

        var s = OpdbExport.Map(entries);

        Assert.Equal(2, s.Invalid.Count);
    }

    [Fact]
    public void Drops_entries_whose_parent_is_missing()
    {
        var entries = Godzilla();
        entries.RemoveAt(2); // the Premium/LE machine, parent of both aliases

        var s = OpdbExport.Map(entries);

        Assert.Empty(s.Aliases);
        Assert.Equal(2, s.Invalid.Count);
        Assert.All(s.Invalid, i => Assert.Contains("not in export", i));
    }

    [Fact]
    public async Task Parses_the_v2_file_shape()
    {
        const string json = """
            {"entries":[
              {"opdbId":"GweeP","opdbGroup":"GweeP","opdbMachine":null,"entryType":"machineGroup","name":"Godzilla",
               "shortName":"GZ","year":2021,"physicalMachine":false,"manufacturer":null,"images":[],"people":[]},
              {"opdbId":"GweeP-MW95j","opdbGroup":"GweeP","opdbMachine":"GweeP-MW95j","entryType":"machine",
               "name":"Godzilla (Pro)","year":2021,"type":"ss","display":"lcd","physicalMachine":true,
               "updatedAt":"2026-10-21T06:30:24.000000Z","manufacturer":{"manufacturerId":12,"name":"Stern"}}
            ]}
            """;

        var s = await OpdbExport.ParseAsync(new MemoryStream(Encoding.UTF8.GetBytes(json)));

        Assert.Equal("GZ", Assert.Single(s.Groups).ShortName);
        Assert.Equal("Stern", Assert.Single(s.Editions).Manufacturer);
    }

    [Fact]
    public async Task Throws_when_the_entries_array_is_missing()
    {
        await Assert.ThrowsAsync<InvalidDataException>(() =>
            OpdbExport.ParseAsync(new MemoryStream("{}"u8.ToArray())));
    }
}
