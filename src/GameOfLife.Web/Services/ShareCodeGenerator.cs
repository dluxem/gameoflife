using System.Security.Cryptography;

namespace GameOfLife.Web.Services;

public class ShareCodeGenerator
{
    private const string Chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    public string Generate(int length = 6)
    {
        return string.Create(length, (object?)null, static (span, _) =>
        {
            Span<byte> bytes = stackalloc byte[span.Length];
            RandomNumberGenerator.Fill(bytes);
            for (int i = 0; i < span.Length; i++)
            {
                span[i] = Chars[bytes[i] % Chars.Length];
            }
        });
    }
}
