using System.Text.Json;
using GameOfLife.Web.Models;
using GameOfLife.Web.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace GameOfLife.Web.Pages.Maps;

[IgnoreAntiforgeryToken]
public class EditModel : PageModel
{
    private readonly MapService _mapService;

    public EditModel(MapService mapService)
    {
        _mapService = mapService;
    }

    public bool IsNew { get; set; } = true;
    public string MapName { get; set; } = string.Empty;
    public int MapWidth { get; set; } = 30;
    public int MapHeight { get; set; } = 30;
    public string CellData { get; set; } = string.Empty;
    public string? SourceCode { get; set; }

    public async Task OnGetAsync(string? code)
    {
        if (!string.IsNullOrWhiteSpace(code))
        {
            var map = await _mapService.GetByShareCodeAsync(code);
            if (map != null)
            {
                IsNew = true;
                MapName = map.Name + " (copy)";
                MapWidth = map.Width;
                MapHeight = map.Height;
                CellData = map.CellData;
                SourceCode = map.ShareCode;
            }
        }
    }

    public async Task<IActionResult> OnPostAsync()
    {
        var body = await new StreamReader(Request.Body).ReadToEndAsync();
        var data = JsonSerializer.Deserialize<SaveRequest>(body, new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        });

        if (data == null || string.IsNullOrWhiteSpace(data.Name))
        {
            return new JsonResult(new { success = false, message = "Name is required." });
        }

        if (data.Width < 3 || data.Width > 200 || data.Height < 3 || data.Height > 200)
        {
            return new JsonResult(new { success = false, message = "Grid size must be between 3 and 200." });
        }

        var request = new CellMapCreateRequest
        {
            Name = data.Name,
            Width = data.Width,
            Height = data.Height,
            CellData = data.CellData
        };

        var map = await _mapService.CreateMapAsync(request);

        return new JsonResult(new { success = true, shareCode = map.ShareCode, message = "Map saved!" });
    }

    private class SaveRequest
    {
        public string Name { get; set; } = string.Empty;
        public int Width { get; set; }
        public int Height { get; set; }
        public string CellData { get; set; } = string.Empty;
    }
}
