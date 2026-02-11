using GameOfLife.Web.Data;
using GameOfLife.Web.Models;
using GameOfLife.Web.Services;
using Microsoft.EntityFrameworkCore;

namespace GameOfLife.Tests;

public class MapServiceTests : IDisposable
{
    private readonly AppDbContext _db;
    private readonly MapService _service;

    public MapServiceTests()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
        _db = new AppDbContext(options);
        _db.Database.EnsureCreated();

        var store = new SqliteMapStore(_db);
        var codeGen = new ShareCodeGenerator();
        _service = new MapService(store, codeGen);
    }

    public void Dispose()
    {
        _db.Dispose();
    }

    [Fact]
    public async Task CreateMapAsync_CreatesMapWithShareCode()
    {
        var request = new CellMapCreateRequest
        {
            Name = "Test Map",
            Width = 10,
            Height = 10,
            CellData = "0000000000\n0000000000"
        };

        var map = await _service.CreateMapAsync(request);

        Assert.NotNull(map);
        Assert.Equal("Test Map", map.Name);
        Assert.Equal(10, map.Width);
        Assert.Equal(10, map.Height);
        Assert.NotEmpty(map.ShareCode);
        Assert.Equal(6, map.ShareCode.Length);
    }

    [Fact]
    public async Task GetByShareCodeAsync_ReturnsMapForValidCode()
    {
        var request = new CellMapCreateRequest
        {
            Name = "Shareable Map",
            Width = 5,
            Height = 5,
            CellData = "00000"
        };
        var created = await _service.CreateMapAsync(request);

        var retrieved = await _service.GetByShareCodeAsync(created.ShareCode);

        Assert.NotNull(retrieved);
        Assert.Equal(created.Id, retrieved!.Id);
        Assert.Equal("Shareable Map", retrieved.Name);
    }

    [Fact]
    public async Task GetByShareCodeAsync_CaseInsensitive()
    {
        var request = new CellMapCreateRequest
        {
            Name = "Case Test",
            Width = 5,
            Height = 5,
            CellData = "00000"
        };
        var created = await _service.CreateMapAsync(request);

        var retrieved = await _service.GetByShareCodeAsync(created.ShareCode.ToLowerInvariant());

        Assert.NotNull(retrieved);
        Assert.Equal(created.Id, retrieved!.Id);
    }

    [Fact]
    public async Task GetByShareCodeAsync_ReturnsNullForInvalidCode()
    {
        var result = await _service.GetByShareCodeAsync("ZZZZZ9");
        Assert.Null(result);
    }

    [Fact]
    public async Task GetByIdAsync_ReturnsCorrectMap()
    {
        var request = new CellMapCreateRequest { Name = "ID Test", Width = 5, Height = 5, CellData = "00000" };
        var created = await _service.CreateMapAsync(request);

        var retrieved = await _service.GetByIdAsync(created.Id);

        Assert.NotNull(retrieved);
        Assert.Equal("ID Test", retrieved!.Name);
    }

    [Fact]
    public async Task UpdateMapAsync_UpdatesNameAndCellData()
    {
        var request = new CellMapCreateRequest { Name = "Original", Width = 5, Height = 5, CellData = "00000" };
        var created = await _service.CreateMapAsync(request);

        var updateRequest = new CellMapUpdateRequest { Name = "Updated", CellData = "11111" };
        var updated = await _service.UpdateMapAsync(created.Id, updateRequest);

        Assert.NotNull(updated);
        Assert.Equal("Updated", updated!.Name);
        Assert.Equal("11111", updated.CellData);
    }

    [Fact]
    public async Task UpdateMapAsync_ReturnsNullForNonexistentId()
    {
        var updateRequest = new CellMapUpdateRequest { Name = "Ghost", CellData = "00000" };
        var result = await _service.UpdateMapAsync(99999, updateRequest);
        Assert.Null(result);
    }

    [Fact]
    public async Task DeleteAsync_RemovesMap()
    {
        var request = new CellMapCreateRequest { Name = "Delete Me", Width = 5, Height = 5, CellData = "00000" };
        var created = await _service.CreateMapAsync(request);

        await _service.DeleteAsync(created.Id);

        var retrieved = await _service.GetByIdAsync(created.Id);
        Assert.Null(retrieved);
    }

    [Fact]
    public async Task GetRecentMapsAsync_ReturnsCorrectCount()
    {
        for (int i = 0; i < 5; i++)
        {
            await _service.CreateMapAsync(new CellMapCreateRequest
            {
                Name = $"Map {i}",
                Width = 5,
                Height = 5,
                CellData = "00000"
            });
        }

        var maps = await _service.GetRecentMapsAsync(3);
        Assert.Equal(3, maps.Count);
    }

    [Fact]
    public async Task GetRecentMapsAsync_ReturnsOrderedByRecent()
    {
        var first = await _service.CreateMapAsync(new CellMapCreateRequest
        {
            Name = "First",
            Width = 5,
            Height = 5,
            CellData = "00000"
        });

        var second = await _service.CreateMapAsync(new CellMapCreateRequest
        {
            Name = "Second",
            Width = 5,
            Height = 5,
            CellData = "11111"
        });

        var maps = await _service.GetRecentMapsAsync(10);

        Assert.Equal(2, maps.Count);
        Assert.Equal("Second", maps[0].Name);
        Assert.Equal("First", maps[1].Name);
    }
}
