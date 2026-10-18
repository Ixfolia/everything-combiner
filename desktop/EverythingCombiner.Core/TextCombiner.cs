using System.Text;

namespace EverythingCombiner.Core;

/// <summary>
/// Joins text files (e.g. transcripts) into one text file containing only their contents.
/// </summary>
public static class TextCombiner
{
    // UTF-8 without a byte order mark, so the output is plain text.
    private static readonly Encoding OutputEncoding = new UTF8Encoding(encoderShouldEmitUTF8Identifier: false);

    /// <summary>
    /// Concatenates the given texts in order. A line break is inserted between two files
    /// only when the earlier one does not already end with one, so lines never run together.
    /// </summary>
    public static string Combine(IEnumerable<string> texts)
    {
        var builder = new StringBuilder();
        foreach (var raw in texts)
        {
            var text = raw.TrimStart('﻿');
            if (text.Length == 0) continue;

            if (builder.Length > 0 && builder[^1] is not ('\n' or '\r'))
            {
                builder.Append(Environment.NewLine);
            }
            builder.Append(text);
        }
        return builder.ToString();
    }

    public static string CombineFiles(IEnumerable<string> paths) =>
        Combine(paths.Select(ReadText));

    public static void CombineFiles(IEnumerable<string> paths, string outputPath) =>
        File.WriteAllText(outputPath, CombineFiles(paths), OutputEncoding);

    /// <summary>Reads a file, honoring any byte order mark and defaulting to UTF-8.</summary>
    public static string ReadText(string path)
    {
        using var reader = new StreamReader(path, Encoding.UTF8, detectEncodingFromByteOrderMarks: true);
        return reader.ReadToEnd();
    }
}
