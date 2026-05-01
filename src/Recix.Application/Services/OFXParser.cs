using System.Globalization;
using System.Text.RegularExpressions;

namespace Recix.Application.Services;

/// <summary>
/// Parseia arquivos OFX (SGML e XML) exportados por bancos brasileiros.
/// Extrai apenas transações de crédito (entradas) com TRNAMT > 0.
/// </summary>
public static partial class OFXParser
{
    public sealed record OFXTransaction(string FitId, decimal Amount, DateTime PostedAt, string? Memo);

    [GeneratedRegex(@"<STMTTRN>(.*?)(?=<STMTTRN>|</BANKTRANLIST>|</STMTTRNRS>|$)",
        RegexOptions.Singleline | RegexOptions.IgnoreCase)]
    private static partial Regex TransactionBlockRegex();

    [GeneratedRegex(@"<(\w+)>([^<\r\n]*)", RegexOptions.Multiline)]
    private static partial Regex FieldRegex();

    public static List<OFXTransaction> ParseTransactions(string content)
    {
        var transactions = new List<OFXTransaction>();

        foreach (Match blockMatch in TransactionBlockRegex().Matches(content))
        {
            var fields = ExtractFields(blockMatch.Value);

            if (!fields.TryGetValue("FITID", out var fitId) || string.IsNullOrWhiteSpace(fitId))
                continue;

            if (!fields.TryGetValue("TRNAMT", out var amountStr))
                continue;

            if (!decimal.TryParse(amountStr.Replace(',', '.'), NumberStyles.Any,
                    CultureInfo.InvariantCulture, out var amount) || amount <= 0)
                continue;

            if (!fields.TryGetValue("DTPOSTED", out var dateStr) || !TryParseOFXDate(dateStr, out var postedAt))
                continue;

            fields.TryGetValue("MEMO", out var memo);

            transactions.Add(new OFXTransaction(fitId.Trim(), amount, postedAt, memo?.Trim()));
        }

        return transactions;
    }

    private static Dictionary<string, string> ExtractFields(string block)
    {
        var fields = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (Match m in FieldRegex().Matches(block))
        {
            var key   = m.Groups[1].Value.ToUpperInvariant();
            var value = m.Groups[2].Value.Trim();

            // Remove closing tag if XML format: <FITID>value</FITID>
            var closeTag = $"</{key}>";
            if (value.EndsWith(closeTag, StringComparison.OrdinalIgnoreCase))
                value = value[..^closeTag.Length].Trim();

            fields.TryAdd(key, value);
        }
        return fields;
    }

    private static bool TryParseOFXDate(string raw, out DateTime result)
    {
        // Remove timezone: 20260401120000[-3:BRT] → 20260401120000
        var idx = raw.IndexOf('[');
        if (idx >= 0) raw = raw[..idx];
        raw = raw.Trim();

        if (raw.Length >= 14 && DateTime.TryParseExact(raw[..14], "yyyyMMddHHmmss",
                CultureInfo.InvariantCulture, DateTimeStyles.None, out result))
        {
            result = DateTime.SpecifyKind(result, DateTimeKind.Local).ToUniversalTime();
            return true;
        }

        if (raw.Length >= 8 && DateTime.TryParseExact(raw[..8], "yyyyMMdd",
                CultureInfo.InvariantCulture, DateTimeStyles.None, out result))
        {
            result = DateTime.SpecifyKind(result, DateTimeKind.Local).ToUniversalTime();
            return true;
        }

        result = default;
        return false;
    }
}
