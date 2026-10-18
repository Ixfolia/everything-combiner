using EverythingCombiner.Core;

namespace EverythingCombiner.App;

public sealed class MainForm : Form
{
    public MainForm()
    {
        Text = "Everything Combiner";
        MinimumSize = new Size(640, 420);
        Size = new Size(820, 560);
        StartPosition = FormStartPosition.CenterScreen;
        Font = new Font("Segoe UI", 9.5f);

        var tabs = new TabControl { Dock = DockStyle.Fill, Padding = new Point(14, 6) };
        tabs.TabPages.Add(CreateTab("Text files", new CombinerKind(
            FileTypeName: "Text",
            Extensions: [".txt"],
            DefaultOutputName: "combined.txt",
            Describe: path => CountLines(path),
            Combine: (paths, output) =>
            {
                TextCombiner.CombineFiles(paths, output);
                return $"Combined {paths.Count} text file{Plural(paths.Count)}";
            })));
        tabs.TabPages.Add(CreateTab("PDF files", new CombinerKind(
            FileTypeName: "PDF",
            Extensions: [".pdf"],
            DefaultOutputName: "combined.pdf",
            Describe: path =>
            {
                var pages = PdfCombiner.GetPageCount(path);
                return $"{pages:N0} page{Plural(pages)}";
            },
            Combine: (paths, output) =>
            {
                var pages = PdfCombiner.CombineFiles(paths, output);
                return $"Combined {paths.Count} PDF{Plural(paths.Count)} ({pages:N0} pages)";
            })));

        Controls.Add(tabs);
    }

    private static TabPage CreateTab(string title, CombinerKind kind)
    {
        var page = new TabPage(title) { Padding = new Padding(10), UseVisualStyleBackColor = true };
        page.Controls.Add(new CombinerPanel(kind) { Dock = DockStyle.Fill });
        return page;
    }

    private static string CountLines(string path)
    {
        var text = TextCombiner.ReadText(path);
        var lines = text.Length == 0 ? 0 : text.Count(c => c == '\n') + (text.EndsWith('\n') ? 0 : 1);
        return $"{lines:N0} line{Plural(lines)}";
    }

    private static string Plural(int count) => count == 1 ? "" : "s";
}
