namespace EverythingCombiner.Core;

/// <summary>
/// Compares strings so embedded numbers sort by value: "part2" comes before "part10".
/// </summary>
public sealed class NaturalStringComparer : IComparer<string?>
{
    public static NaturalStringComparer Instance { get; } = new();

    public int Compare(string? x, string? y)
    {
        if (ReferenceEquals(x, y)) return 0;
        if (x is null) return -1;
        if (y is null) return 1;

        int i = 0, j = 0;
        while (i < x.Length && j < y.Length)
        {
            if (char.IsDigit(x[i]) && char.IsDigit(y[j]))
            {
                int startX = i, startY = j;
                while (i < x.Length && char.IsDigit(x[i])) i++;
                while (j < y.Length && char.IsDigit(y[j])) j++;

                var numX = x.AsSpan(startX, i - startX).TrimStart('0');
                var numY = y.AsSpan(startY, j - startY).TrimStart('0');
                if (numX.Length != numY.Length) return numX.Length.CompareTo(numY.Length);
                int digits = numX.SequenceCompareTo(numY);
                if (digits != 0) return Math.Sign(digits);
            }
            else
            {
                int chars = string.Compare(x, i, y, j, 1, StringComparison.CurrentCultureIgnoreCase);
                if (chars != 0) return chars;
                i++;
                j++;
            }
        }

        int remaining = (x.Length - i).CompareTo(y.Length - j);
        return remaining != 0 ? remaining : string.Compare(x, y, StringComparison.Ordinal);
    }
}
