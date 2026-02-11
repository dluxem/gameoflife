using GameOfLife.Web.Models;
using Microsoft.EntityFrameworkCore;

namespace GameOfLife.Web.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<CellMap> CellMaps => Set<CellMap>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<CellMap>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.ShareCode).IsUnique();
            entity.Property(e => e.Name).IsRequired().HasMaxLength(100);
            entity.Property(e => e.ShareCode).IsRequired().HasMaxLength(8);
            entity.Property(e => e.CellData).IsRequired();
        });
    }
}
