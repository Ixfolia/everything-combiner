using System.Diagnostics;
using EverythingCombiner.Core;

namespace EverythingCombiner.App;

/// <summary>
/// A reorderable list of input files plus a Combine button, for one <see cref="CombinerKind"/>.
/// </summary>
public sealed class CombinerPanel : UserControl
{
    private sealed record InputFile(string Path, long Size, string Info);

    // Marker type so internal row drags are distinguishable from files dropped from Explorer.
    private sealed record RowDrag(int[] Indices);

    private readonly CombinerKind _kind;
    private readonly List<InputFile> _files = [];
    private readonly ListView _list;
    private readonly Label _status;
    private readonly Button _combine, _remove, _up, _down, _sort, _clear;

    public CombinerPanel(CombinerKind kind)
    {
        _kind = kind;

        _list = new ListView
        {
            Dock = DockStyle.Fill,
            View = View.Details,
            FullRowSelect = true,
            HideSelection = false,
            AllowDrop = true,
            HeaderStyle = ColumnHeaderStyle.Nonclickable,
        };
        _list.Columns.Add("#", 40, HorizontalAlignment.Right);
        _list.Columns.Add("File", 220);
        _list.Columns.Add("Size", 80, HorizontalAlignment.Right);
        _list.Columns.Add(kind.FileTypeName == "PDF" ? "Pages" : "Lines", 90, HorizontalAlignment.Right);
        _list.Columns.Add("Folder", 200);
        _list.SelectedIndexChanged += (_, _) => UpdateButtons();
        _list.KeyDown += OnListKeyDown;
        _list.ItemDrag += (_, _) => StartRowDrag();
        _list.DragEnter += OnListDragOver;
        _list.DragOver += OnListDragOver;
        _list.DragDrop += OnListDragDrop;

        var add = MakeButton("Add files…", (_, _) => BrowseForFiles());
        var addFolder = MakeButton("Add folder…", (_, _) => BrowseForFolder());
        _remove = MakeButton("Remove", (_, _) => RemoveSelected());
        _up = MakeButton("Move up", (_, _) => MoveSelected(-1));
        _down = MakeButton("Move down", (_, _) => MoveSelected(1));
        _sort = MakeButton("Sort A→Z", (_, _) => SortByName());
        _clear = MakeButton("Clear", (_, _) => { _files.Clear(); Refill(); });

        var buttons = new FlowLayoutPanel
        {
            Dock = DockStyle.Fill,
            FlowDirection = FlowDirection.TopDown,
            WrapContents = false,
            AutoSize = true,
            Padding = new Padding(8, 0, 0, 0),
        };
        buttons.Controls.AddRange([add, addFolder, Spacer(), _remove, _up, _down, Spacer(), _sort, _clear]);

        var hint = new Label
        {
            AutoSize = true,
            Text = $"Drag {kind.Extensions[0]} files or folders here, or use Add files. " +
                   "They are combined from top to bottom; drag rows to reorder.",
            Margin = new Padding(0, 0, 0, 8),
        };

        _status = new Label { Dock = DockStyle.Fill, TextAlign = ContentAlignment.MiddleLeft, AutoEllipsis = true };
        _combine = new Button
        {
            Text = $"Combine into one {kind.Extensions[0]}…",
            AutoSize = true,
            Padding = new Padding(10, 4, 10, 4),
            Anchor = AnchorStyles.Right,
        };
        _combine.Click += async (_, _) => await CombineAsync();

        var layout = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 2, RowCount = 3 };
        layout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
        layout.ColumnStyles.Add(new ColumnStyle(SizeType.AutoSize));
        layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        layout.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
        layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        layout.Controls.Add(hint, 0, 0);
        layout.SetColumnSpan(hint, 2);
        layout.Controls.Add(_list, 0, 1);
        layout.Controls.Add(buttons, 1, 1);
        layout.Controls.Add(_status, 0, 2);
        layout.Controls.Add(_combine, 1, 2);
        Controls.Add(layout);

        Refill();
    }

    private static Button MakeButton(string text, EventHandler onClick)
    {
        var button = new Button { Text = text, Width = 120, AutoSize = true, Margin = new Padding(0, 0, 0, 6) };
        button.Click += onClick;
        return button;
    }

    private static Control Spacer() => new Panel { Height = 8, Width = 1, Margin = Padding.Empty };

    // ---- Adding files -------------------------------------------------------

    private void BrowseForFiles()
    {
        using var dialog = new OpenFileDialog
        {
            Title = $"Choose {_kind.FileTypeName} files to combine",
            Filter = _kind.DialogFilter,
            Multiselect = true,
        };
        if (dialog.ShowDialog(this) == DialogResult.OK)
        {
            // The dialog returns files in an arbitrary order, so sort them naturally.
            AddPaths(dialog.FileNames.OrderBy(Path.GetFileName, NaturalStringComparer.Instance));
        }
    }

    private void BrowseForFolder()
    {
        using var dialog = new FolderBrowserDialog
        {
            Description = $"Choose a folder; every {_kind.FileTypeName} file in it will be added in name order.",
            UseDescriptionForTitle = true,
        };
        if (dialog.ShowDialog(this) == DialogResult.OK)
        {
            AddPaths([dialog.SelectedPath]);
        }
    }

    private IEnumerable<string> ExpandFolders(IEnumerable<string> paths)
    {
        foreach (var path in paths)
        {
            if (Directory.Exists(path))
            {
                var files = Directory.EnumerateFiles(path)
                    .Where(_kind.Accepts)
                    .OrderBy(Path.GetFileName, NaturalStringComparer.Instance);
                foreach (var file in files) yield return file;
            }
            else
            {
                yield return path;
            }
        }
    }

    private void AddPaths(IEnumerable<string> paths)
    {
        int added = 0, skipped = 0;
        var problems = new List<string>();

        foreach (var path in ExpandFolders(paths))
        {
            if (!_kind.Accepts(path))
            {
                skipped++;
                continue;
            }
            try
            {
                _files.Add(new InputFile(path, new FileInfo(path).Length, _kind.Describe(path)));
                added++;
            }
            catch (Exception ex)
            {
                problems.Add($"{Path.GetFileName(path)}: {ex.Message}");
            }
        }

        Refill();
        var message = $"Added {added} file{(added == 1 ? "" : "s")}.";
        if (skipped > 0) message += $" Skipped {skipped} that {(skipped == 1 ? "is" : "are")} not {_kind.Extensions[0]}.";
        SetStatus(message);

        if (problems.Count > 0)
        {
            MessageBox.Show(this, "These files could not be read and were not added:\n\n" + string.Join("\n", problems),
                "Everything Combiner", MessageBoxButtons.OK, MessageBoxIcon.Warning);
        }
    }

    // ---- Editing the list ---------------------------------------------------

    private int[] SelectedIndices() => _list.SelectedIndices.Cast<int>().Order().ToArray();

    private void RemoveSelected()
    {
        foreach (var index in SelectedIndices().Reverse()) _files.RemoveAt(index);
        Refill();
    }

    private void MoveSelected(int delta)
    {
        var indices = SelectedIndices();
        if (indices.Length == 0) return;
        if (delta < 0 && indices[0] == 0) return;
        if (delta > 0 && indices[^1] == _files.Count - 1) return;

        var order = delta < 0 ? indices : indices.Reverse().ToArray();
        foreach (var index in order)
        {
            (_files[index], _files[index + delta]) = (_files[index + delta], _files[index]);
        }
        Refill(indices.Select(i => i + delta));
    }

    private void MoveTo(int[] indices, int targetIndex)
    {
        var moving = indices.Select(i => _files[i]).ToList();
        // Account for removed rows above the drop point.
        targetIndex -= indices.Count(i => i < targetIndex);
        foreach (var index in indices.Reverse()) _files.RemoveAt(index);
        _files.InsertRange(targetIndex, moving);
        Refill(Enumerable.Range(targetIndex, moving.Count));
    }

    private void SortByName()
    {
        var sorted = _files.OrderBy(f => Path.GetFileName(f.Path), NaturalStringComparer.Instance).ToList();
        _files.Clear();
        _files.AddRange(sorted);
        Refill();
    }

    private void OnListKeyDown(object? sender, KeyEventArgs e)
    {
        if (e.KeyCode == Keys.Delete)
        {
            RemoveSelected();
        }
        else if (e.Control && e.KeyCode == Keys.A)
        {
            foreach (ListViewItem item in _list.Items) item.Selected = true;
        }
        else if (e.Alt && e.KeyCode is Keys.Up or Keys.Down)
        {
            MoveSelected(e.KeyCode == Keys.Up ? -1 : 1);
        }
        else
        {
            return;
        }
        e.Handled = true;
    }

    // ---- Drag and drop ------------------------------------------------------

    private void StartRowDrag()
    {
        var indices = SelectedIndices();
        if (indices.Length > 0) _list.DoDragDrop(new RowDrag(indices), DragDropEffects.Move);
    }

    private void OnListDragOver(object? sender, DragEventArgs e)
    {
        if (e.Data?.GetDataPresent(typeof(RowDrag)) == true)
        {
            e.Effect = DragDropEffects.Move;
            var target = RowAt(e);
            _list.InsertionMark.Index = target < _files.Count ? target : _files.Count - 1;
            _list.InsertionMark.AppearsAfterItem = target >= _files.Count;
        }
        else
        {
            e.Effect = e.Data?.GetDataPresent(DataFormats.FileDrop) == true ? DragDropEffects.Copy : DragDropEffects.None;
        }
    }

    private void OnListDragDrop(object? sender, DragEventArgs e)
    {
        _list.InsertionMark.Index = -1;
        if (e.Data?.GetData(typeof(RowDrag)) is RowDrag drag)
        {
            MoveTo(drag.Indices, RowAt(e));
        }
        else if (e.Data?.GetData(DataFormats.FileDrop) is string[] paths)
        {
            // Explorer's drop order is unpredictable, so sort the dropped batch by name.
            AddPaths(paths.OrderBy(Path.GetFileName, NaturalStringComparer.Instance));
        }
    }

    /// <summary>The list position a drop at the cursor would insert before.</summary>
    private int RowAt(DragEventArgs e)
    {
        var point = _list.PointToClient(new Point(e.X, e.Y));
        var item = _list.GetItemAt(point.X, point.Y);
        if (item is null) return _files.Count;
        var bounds = item.GetBounds(ItemBoundsPortion.Entire);
        return point.Y > bounds.Top + bounds.Height / 2 ? item.Index + 1 : item.Index;
    }

    // ---- Combining ----------------------------------------------------------

    private async Task CombineAsync()
    {
        if (_files.Count == 0) return;

        using var dialog = new SaveFileDialog
        {
            Title = $"Save combined {_kind.FileTypeName} file",
            Filter = _kind.DialogFilter,
            DefaultExt = _kind.Extensions[0],
            AddExtension = true,
            FileName = _kind.DefaultOutputName,
            InitialDirectory = Path.GetDirectoryName(_files[0].Path),
            OverwritePrompt = true,
        };
        if (dialog.ShowDialog(this) != DialogResult.OK) return;

        var output = dialog.FileName;
        if (!string.Equals(Path.GetExtension(output), _kind.Extensions[0], StringComparison.OrdinalIgnoreCase))
        {
            output += _kind.Extensions[0];
        }

        var inputs = _files.Select(f => f.Path).ToList();
        if (inputs.Any(p => string.Equals(Path.GetFullPath(p), Path.GetFullPath(output), StringComparison.OrdinalIgnoreCase)))
        {
            MessageBox.Show(this, "The output file is also one of the inputs. Please choose a different name.",
                "Everything Combiner", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return;
        }

        UseWaitCursor = true;
        Enabled = false;
        SetStatus("Combining…");
        string? message = null;
        Exception? failure = null;
        try
        {
            message = await Task.Run(() => _kind.Combine(inputs, output));
        }
        catch (Exception ex)
        {
            failure = ex;
        }

        // Re-enable the panel before showing a dialog so it doesn't sit greyed out behind it.
        Enabled = true;
        UseWaitCursor = false;
        UpdateButtons();

        if (failure is not null)
        {
            SetStatus("Combining failed.");
            MessageBox.Show(this, failure.Message, "Everything Combiner", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return;
        }

        SetStatus($"{message} into {Path.GetFileName(output)}.");
        var open = MessageBox.Show(this, $"{message} into:\n{output}\n\nOpen it now?",
            "Everything Combiner", MessageBoxButtons.YesNo, MessageBoxIcon.Information);
        if (open == DialogResult.Yes)
        {
            Process.Start(new ProcessStartInfo(output) { UseShellExecute = true });
        }
    }

    // ---- Rendering ----------------------------------------------------------

    private void Refill(IEnumerable<int>? select = null)
    {
        var selected = new HashSet<int>(select ?? []);
        _list.BeginUpdate();
        _list.Items.Clear();
        for (var i = 0; i < _files.Count; i++)
        {
            var file = _files[i];
            var item = new ListViewItem([
                (i + 1).ToString(),
                Path.GetFileName(file.Path),
                FormatSize(file.Size),
                file.Info,
                Path.GetDirectoryName(file.Path) ?? "",
            ]) { ToolTipText = file.Path, Selected = selected.Contains(i) };
            _list.Items.Add(item);
        }
        _list.EndUpdate();
        if (selected.Count > 0) _list.EnsureVisible(selected.Max());

        if (_files.Count == 0) SetStatus("No files added yet.");
        UpdateButtons();
    }

    private void UpdateButtons()
    {
        var indices = SelectedIndices();
        _remove.Enabled = indices.Length > 0;
        _up.Enabled = indices.Length > 0 && indices[0] > 0;
        _down.Enabled = indices.Length > 0 && indices[^1] < _files.Count - 1;
        _sort.Enabled = _files.Count > 1;
        _clear.Enabled = _files.Count > 0;
        _combine.Enabled = _files.Count > 0;
    }

    private void SetStatus(string text) =>
        _status.Text = _files.Count == 0 ? text : $"{_files.Count} file{(_files.Count == 1 ? "" : "s")} · {text}";

    private static string FormatSize(long bytes) => bytes switch
    {
        < 1024 => $"{bytes} B",
        < 1024 * 1024 => $"{bytes / 1024.0:0.#} KB",
        _ => $"{bytes / (1024.0 * 1024):0.#} MB",
    };
}
