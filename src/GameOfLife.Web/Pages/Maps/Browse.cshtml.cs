using GameOfLife.Web.Models;
using GameOfLife.Web.Services;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace GameOfLife.Web.Pages.Maps;

public class BrowseModel : PageModel
{
    private readonly MapService _mapService;

    public BrowseModel(MapService mapService)
    {
        _mapService = mapService;
    }

    public List<CellMap> Maps { get; set; } = new();

    public async Task OnGetAsync()
    {
        Maps = await _mapService.GetRecentMapsAsync(50);
    }
}
