using GameOfLife.Web.Data;
using GameOfLife.Web.Models;

namespace GameOfLife.Web.Services;

public class MapService
{
    private readonly IMapStore _store;
    private readonly ShareCodeGenerator _codeGenerator;

    public MapService(IMapStore store, ShareCodeGenerator codeGenerator)
    {
        _store = store;
        _codeGenerator = codeGenerator;
    }

    public Task<CellMap?> GetByIdAsync(int id) => _store.GetByIdAsync(id);

    public Task<CellMap?> GetByShareCodeAsync(string shareCode) =>
        _store.GetByShareCodeAsync(shareCode.ToUpperInvariant());

    public Task<List<CellMap>> GetRecentMapsAsync(int count = 20) =>
        _store.GetRecentMapsAsync(count);

    public async Task<CellMap> CreateMapAsync(CellMapCreateRequest request)
    {
        var map = new CellMap
        {
            Name = request.Name,
            Width = request.Width,
            Height = request.Height,
            CellData = request.CellData,
            ShareCode = await GenerateUniqueShareCode()
        };

        return await _store.CreateAsync(map);
    }

    public async Task<CellMap?> UpdateMapAsync(int id, CellMapUpdateRequest request)
    {
        var map = await _store.GetByIdAsync(id);
        if (map == null) return null;

        map.Name = request.Name;
        map.CellData = request.CellData;

        return await _store.UpdateAsync(map);
    }

    public Task DeleteAsync(int id) => _store.DeleteAsync(id);

    private async Task<string> GenerateUniqueShareCode()
    {
        for (int i = 0; i < 10; i++)
        {
            var code = _codeGenerator.Generate();
            var existing = await _store.GetByShareCodeAsync(code);
            if (existing == null) return code;
        }
        throw new InvalidOperationException("Failed to generate a unique share code after 10 attempts.");
    }
}
