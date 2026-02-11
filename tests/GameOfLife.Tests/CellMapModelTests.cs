using System.ComponentModel.DataAnnotations;
using GameOfLife.Web.Models;

namespace GameOfLife.Tests;

public class CellMapModelTests
{
    [Fact]
    public void CellMap_DefaultValues_AreCorrect()
    {
        var map = new CellMap();

        Assert.Equal(string.Empty, map.Name);
        Assert.Equal(string.Empty, map.ShareCode);
        Assert.Equal(string.Empty, map.CellData);
        Assert.Null(map.CreatedBy);
    }

    [Fact]
    public void CellMap_CreatedAt_DefaultsToUtcNow()
    {
        var before = DateTime.UtcNow;
        var map = new CellMap();
        var after = DateTime.UtcNow;

        Assert.InRange(map.CreatedAt, before, after);
    }

    [Fact]
    public void CellMapCreateRequest_Validation_NameRequired()
    {
        var request = new CellMapCreateRequest { Name = "", Width = 10, Height = 10 };
        var context = new ValidationContext(request);
        var results = new List<ValidationResult>();

        var isValid = Validator.TryValidateObject(request, context, results, true);

        Assert.False(isValid);
        Assert.Contains(results, r => r.MemberNames.Contains("Name"));
    }

    [Theory]
    [InlineData(2, false)]
    [InlineData(3, true)]
    [InlineData(100, true)]
    [InlineData(200, true)]
    [InlineData(201, false)]
    public void CellMapCreateRequest_Validation_WidthRange(int width, bool shouldBeValid)
    {
        var request = new CellMapCreateRequest { Name = "Test", Width = width, Height = 10 };
        var context = new ValidationContext(request);
        var results = new List<ValidationResult>();

        var isValid = Validator.TryValidateObject(request, context, results, true);

        if (shouldBeValid)
            Assert.DoesNotContain(results, r => r.MemberNames.Contains("Width"));
        else
            Assert.Contains(results, r => r.MemberNames.Contains("Width"));
    }

    [Theory]
    [InlineData(2, false)]
    [InlineData(3, true)]
    [InlineData(200, true)]
    [InlineData(201, false)]
    public void CellMapCreateRequest_Validation_HeightRange(int height, bool shouldBeValid)
    {
        var request = new CellMapCreateRequest { Name = "Test", Width = 10, Height = height };
        var context = new ValidationContext(request);
        var results = new List<ValidationResult>();

        var isValid = Validator.TryValidateObject(request, context, results, true);

        if (shouldBeValid)
            Assert.DoesNotContain(results, r => r.MemberNames.Contains("Height"));
        else
            Assert.Contains(results, r => r.MemberNames.Contains("Height"));
    }
}
