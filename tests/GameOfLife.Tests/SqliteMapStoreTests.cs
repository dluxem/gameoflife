using GameOfLife.Web.Data;
using GameOfLife.Web.Models;
using Microsoft.EntityFrameworkCore;

namespace GameOfLife.Tests;

public class SqliteMapStoreTests : IDisposable
{
    private readonly AppDbContext _db;
    private readonly SqliteMapStore _store;

    public SqliteMapStoreTests()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
        _db = new AppDbContext(options);
        _db.Database.EnsureCreated();
        _store = new SqliteMapStore(_db);
    }

    public void Dispose()
    {
        _db.Dispose();
    }

    [Fact]
    public async Task CreateAsync_PersistsMap()
    {
        var map = new CellMap
        {
            Name = "Test",
            ShareCode = "ABC123",
            Width = 10,
            Height = 10,
            CellData = "0101010101"
        };

        var created = await _store.CreateAsync(map);

        Assert.True(created.Id > 0);
        var retrieved = await _store.GetByIdAsync(created.Id);
        Assert.NotNull(retrieved);
        Assert.Equal("Test", retrieved!.Name);
    }

    [Fact]
    public async Task GetByShareCodeAsync_FindsByCode()
    {
        var map = new CellMap
        {
            Name = "Code Test",
            ShareCode = "XYZ789",
            Width = 5,
            Height = 5,
            CellData = "11111"
        };
        await _store.CreateAsync(map);

        var result = await _store.GetByShareCodeAsync("XYZ789");

        Assert.NotNull(result);
        Assert.Equal("Code Test", result!.Name);
    }

    [Fact]
    public async Task GetByShareCodeAsync_ReturnsNullForMissing()
    {
        var result = await _store.GetByShareCodeAsync("NOPE00");
        Assert.Null(result);
    }

    [Fact]
    public async Task UpdateAsync_UpdatesFields()
    {
        var map = new CellMap
        {
            Name = "Before",
            ShareCode = "UPD001",
            Width = 5,
            Height = 5,
            CellData = "00000"
        };
        await _store.CreateAsync(map);

        map.Name = "After";
        map.CellData = "11111";
        var updated = await _store.UpdateAsync(map);

        Assert.Equal("After", updated.Name);
        Assert.Equal("11111", updated.CellData);
    }

    [Fact]
    public async Task DeleteAsync_RemovesMap()
    {
        var map = new CellMap
        {
            Name = "Delete Me",
            ShareCode = "DEL001",
            Width = 5,
            Height = 5,
            CellData = "00000"
        };
        await _store.CreateAsync(map);

        await _store.DeleteAsync(map.Id);

        var result = await _store.GetByIdAsync(map.Id);
        Assert.Null(result);
    }

    [Fact]
    public async Task DeleteAsync_NoErrorForMissingId()
    {
        await _store.DeleteAsync(99999);
    }

    [Fact]
    public async Task GetRecentMapsAsync_LimitsResults()
    {
        for (int i = 0; i < 5; i++)
        {
            await _store.CreateAsync(new CellMap
            {
                Name = $"Map {i}",
                ShareCode = $"LIM{i:D3}",
                Width = 5,
                Height = 5,
                CellData = "00000"
            });
        }

        var result = await _store.GetRecentMapsAsync(2);
        Assert.Equal(2, result.Count);
    }
}
