using GameOfLife.Web.Models;
using GameOfLife.Web.Services;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace GameOfLife.Web.Pages;

public class IndexModel : PageModel
{
    private readonly MapService _mapService;

    public IndexModel(MapService mapService)
    {
        _mapService = mapService;
    }

    public List<CellMap> RecentMaps { get; set; } = new();

    public async Task OnGetAsync()
    {
        RecentMaps = await _mapService.GetRecentMapsAsync(12);
    }
}
