using GameOfLife.Web.Models;
using GameOfLife.Web.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace GameOfLife.Web.Pages.Maps;

public class PlayModel : PageModel
{
    private readonly MapService _mapService;

    public PlayModel(MapService mapService)
    {
        _mapService = mapService;
    }

    public CellMap? Map { get; set; }

    public async Task<IActionResult> OnGetAsync(string? code)
    {
        if (string.IsNullOrWhiteSpace(code))
        {
            return Page();
        }

        Map = await _mapService.GetByShareCodeAsync(code);
        return Page();
    }
}
