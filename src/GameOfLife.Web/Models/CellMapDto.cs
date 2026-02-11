using System.ComponentModel.DataAnnotations;

namespace GameOfLife.Web.Models;

public class CellMapCreateRequest
{
    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [Range(3, 200)]
    public int Width { get; set; } = 20;

    [Range(3, 200)]
    public int Height { get; set; } = 20;

    public string CellData { get; set; } = string.Empty;
}

public class CellMapUpdateRequest
{
    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    public string CellData { get; set; } = string.Empty;
}
