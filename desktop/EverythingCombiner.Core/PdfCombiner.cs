using PdfSharp.Pdf;
using PdfSharp.Pdf.IO;

namespace EverythingCombiner.Core;

/// <summary>
/// Merges PDF files into one PDF containing every page of each input, in order.
/// </summary>
public static class PdfCombiner
{
    /// <returns>The number of pages in the combined PDF.</returns>
    public static int CombineFiles(IEnumerable<string> paths, string outputPath)
    {
        using var output = new PdfDocument();

        foreach (var path in paths)
        {
            PdfDocument input;
            try
            {
                input = PdfReader.Open(path, PdfDocumentOpenMode.Import);
            }
            catch (Exception ex)
            {
                throw new InvalidOperationException($"Could not read \"{Path.GetFileName(path)}\": {ex.Message}", ex);
            }

            using (input)
            {
                foreach (var page in input.Pages)
                {
                    output.AddPage(page);
                }
            }
        }

        if (output.PageCount == 0)
        {
            throw new InvalidOperationException("The selected PDFs have no pages to combine.");
        }

        // Saving finalizes the document, so read the page count first.
        var pageCount = output.PageCount;
        output.Save(outputPath);
        return pageCount;
    }

    public static int GetPageCount(string path)
    {
        using var doc = PdfReader.Open(path, PdfDocumentOpenMode.Import);
        return doc.PageCount;
    }
}
