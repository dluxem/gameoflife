using GameOfLife.Web.Models;
using Microsoft.EntityFrameworkCore;

namespace GameOfLife.Web.Data;

public class SqliteMapStore : IMapStore
{
    private readonly AppDbContext _db;

    public SqliteMapStore(AppDbContext db)
    {
        _db = db;
    }

    public async Task<CellMap?> GetByIdAsync(int id)
    {
        return await _db.CellMaps.FindAsync(id);
    }

    public async Task<CellMap?> GetByShareCodeAsync(string shareCode)
    {
        return await _db.CellMaps.FirstOrDefaultAsync(m => m.ShareCode == shareCode);
    }

    public async Task<List<CellMap>> GetRecentMapsAsync(int count = 20)
    {
        return await _db.CellMaps
            .OrderByDescending(m => m.UpdatedAt)
            .Take(count)
            .ToListAsync();
    }

    public async Task<CellMap> CreateAsync(CellMap map)
    {
        _db.CellMaps.Add(map);
        await _db.SaveChangesAsync();
        return map;
    }

    public async Task<CellMap> UpdateAsync(CellMap map)
    {
        map.UpdatedAt = DateTime.UtcNow;
        _db.CellMaps.Update(map);
        await _db.SaveChangesAsync();
        return map;
    }

    public async Task DeleteAsync(int id)
    {
        var map = await _db.CellMaps.FindAsync(id);
        if (map != null)
        {
            _db.CellMaps.Remove(map);
            await _db.SaveChangesAsync();
        }
    }
}
