using GameOfLife.Web.Models;

namespace GameOfLife.Web.Data;

public interface IMapStore
{
    Task<CellMap?> GetByIdAsync(int id);
    Task<CellMap?> GetByShareCodeAsync(string shareCode);
    Task<List<CellMap>> GetRecentMapsAsync(int count = 20);
    Task<CellMap> CreateAsync(CellMap map);
    Task<CellMap> UpdateAsync(CellMap map);
    Task DeleteAsync(int id);
}
