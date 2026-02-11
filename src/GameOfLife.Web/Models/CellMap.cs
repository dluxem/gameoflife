using System.ComponentModel.DataAnnotations;

namespace GameOfLife.Web.Models;

public class CellMap
{
    public int Id { get; set; }

    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [Required]
    [MaxLength(8)]
    public string ShareCode { get; set; } = string.Empty;

    [Range(3, 200)]
    public int Width { get; set; }

    [Range(3, 200)]
    public int Height { get; set; }

    public string CellData { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public string? CreatedBy { get; set; }
}
