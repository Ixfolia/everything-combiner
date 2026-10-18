using EverythingCombiner.Core;
using PdfSharp.Pdf;
using PdfSharp.Pdf.IO;

namespace EverythingCombiner.Tests;

public sealed class CombinerTests : IDisposable
{
    private readonly string _dir = Directory.CreateTempSubdirectory("combiner-tests").FullName;

    public void Dispose() => Directory.Delete(_dir, recursive: true);

    private string WriteFile(string name, string text)
    {
        var path = Path.Combine(_dir, name);
        File.WriteAllText(path, text);
        return path;
    }

    private string WritePdf(string name, params double[] pageWidths)
    {
        using var doc = new PdfDocument();
        foreach (var width in pageWidths)
        {
            var page = doc.AddPage();
            page.Width = PdfSharp.Drawing.XUnit.FromPoint(width);
        }
        var path = Path.Combine(_dir, name);
        doc.Save(path);
        return path;
    }

    [Fact]
    public void Text_output_is_only_the_file_contents_in_order()
    {
        var combined = TextCombiner.Combine(["First line\n", "Second\nfile\n", "Third"]);
        Assert.Equal("First line\nSecond\nfile\nThird", combined);
    }

    [Fact]
    public void Text_adds_a_line_break_only_when_a_file_does_not_end_with_one()
    {
        var combined = TextCombiner.Combine(["no newline", "next"]);
        Assert.Equal($"no newline{Environment.NewLine}next", combined);
    }

    [Fact]
    public void Text_strips_byte_order_marks_and_skips_empty_files()
    {
        var combined = TextCombiner.Combine(["﻿a\n", "", "﻿b\n"]);
        Assert.Equal("a\nb\n", combined);
    }

    [Fact]
    public void Text_files_are_written_as_plain_utf8_without_bom()
    {
        var a = WriteFile("a.txt", "Héllo\n");
        var b = WriteFile("b.txt", "World\n");
        var output = Path.Combine(_dir, "combined.txt");

        TextCombiner.CombineFiles([a, b], output);

        var bytes = File.ReadAllBytes(output);
        Assert.NotEqual(0xEF, bytes[0]);
        Assert.Equal("Héllo\nWorld\n", File.ReadAllText(output));
    }

    [Fact]
    public void Pdf_contains_every_page_of_each_file_in_order()
    {
        var a = WritePdf("a.pdf", 100, 101);
        var b = WritePdf("b.pdf", 200, 201, 202);
        var output = Path.Combine(_dir, "combined.pdf");

        var pageCount = PdfCombiner.CombineFiles([b, a], output);

        Assert.Equal(5, pageCount);
        using var result = PdfReader.Open(output, PdfDocumentOpenMode.Import);
        var widths = result.Pages.Cast<PdfPage>().Select(p => Math.Round(p.Width.Point)).ToArray();
        Assert.Equal([200, 201, 202, 100, 101], widths);
    }

    [Fact]
    public void Pdf_error_names_the_unreadable_file()
    {
        var bad = WriteFile("broken.pdf", "not a pdf");
        var ex = Assert.Throws<InvalidOperationException>(
            () => PdfCombiner.CombineFiles([bad], Path.Combine(_dir, "out.pdf")));
        Assert.Contains("broken.pdf", ex.Message);
    }

    [Fact]
    public void Natural_sort_orders_numbered_files_by_value()
    {
        string[] names = ["part10.txt", "Part2.txt", "part1.txt", "part02b.txt"];
        var sorted = names.Order(NaturalStringComparer.Instance).ToArray();
        Assert.Equal(["part1.txt", "Part2.txt", "part02b.txt", "part10.txt"], sorted);
    }
}
