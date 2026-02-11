using GameOfLife.Web.Services;

namespace GameOfLife.Tests;

public class ShareCodeGeneratorTests
{
    private readonly ShareCodeGenerator _generator = new();

    [Fact]
    public void Generate_ReturnsCodeOfCorrectLength()
    {
        var code = _generator.Generate(6);
        Assert.Equal(6, code.Length);
    }

    [Fact]
    public void Generate_ReturnsOnlyValidCharacters()
    {
        var validChars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        for (int i = 0; i < 100; i++)
        {
            var code = _generator.Generate();
            foreach (var c in code)
            {
                Assert.Contains(c, validChars);
            }
        }
    }

    [Fact]
    public void Generate_ReturnsDifferentCodesOnMultipleCalls()
    {
        var codes = new HashSet<string>();
        for (int i = 0; i < 50; i++)
        {
            codes.Add(_generator.Generate());
        }
        Assert.True(codes.Count > 1);
    }

    [Theory]
    [InlineData(4)]
    [InlineData(6)]
    [InlineData(8)]
    public void Generate_RespectsCustomLength(int length)
    {
        var code = _generator.Generate(length);
        Assert.Equal(length, code.Length);
    }
}
