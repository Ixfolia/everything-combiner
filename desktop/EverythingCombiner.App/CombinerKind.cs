namespace EverythingCombiner.App;

/// <summary>Describes one kind of combiner shown as a tab in the main window.</summary>
/// <param name="FileTypeName">Name used in dialogs, e.g. "PDF".</param>
/// <param name="Extensions">Accepted input extensions; the first is also the output extension.</param>
/// <param name="DefaultOutputName">File name suggested when saving.</param>
/// <param name="Describe">Returns a short summary of an input file, e.g. its page count.</param>
/// <param name="Combine">Combines the inputs into the output path and returns a status message.</param>
public sealed record CombinerKind(
    string FileTypeName,
    string[] Extensions,
    string DefaultOutputName,
    Func<string, string> Describe,
    Func<IReadOnlyList<string>, string, string> Combine)
{
    public string DialogFilter =>
        $"{FileTypeName} files ({string.Join(";", Extensions.Select(e => "*" + e))})|{string.Join(";", Extensions.Select(e => "*" + e))}";

    public bool Accepts(string path) =>
        Extensions.Contains(Path.GetExtension(path), StringComparer.OrdinalIgnoreCase);
}
