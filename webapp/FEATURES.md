# Tab Organizer Features

## Purpose
- Import and edit Chrome tabs JSON before re-importing into the extension.
- Manage windows, groups, and tabs with a focused visual editor.

## Import / Export
- Import JSON via file picker.
- Export JSON via explicit button click (no automatic export).
- JSON schema stays in sync with the extension export.
- Theme toggle stored in localStorage.

## Layout
- Multi-column layout: one column per window.
- Rightmost "New Window" column stays at the far right.
- Horizontal scrolling supported for large sets of windows.
 - Light and dark modes (toggle in header).

## Tabs
- Tabs listed under their group or Ungrouped.
- Click a tab title to open the URL in a new browser tab.
- Close a tab with the "×" control.
- Shows favicon next to the title (Google favicon service).
- Shows truncated title/URL with a hover card for full details.
- Hovered tab highlights subtly.
- Recently moved tab highlights briefly.
- Dragged tab fades while dragging.

## Groups
- Create and delete groups inside a window.
- Group background tinted with the selected color.
- Group deletion prompts for confirmation if it contains tabs.
- Group header split into title/close row + color/count row.

## Windows
- Create and delete windows.
- Window deletion prompts for confirmation if it contains tabs.

## Drag and Drop
- Drag tabs to reorder within a list.
- Drag tabs across groups or windows.
- Drop placeholder shows exact insertion location.
- Hover card suppressed during drag operations.

## Search
- Two search inputs: title and URL.
- Filters are combined with AND logic.
- Default search is fuzzy subsequence matching.
- Prefix with a single quote for substring match (no fuzzy):
  - Example: `'docs` matches titles/URLs containing "docs".
- Toggle to show only duplicate URLs.

## Counts
- Overall tab count (filtered) shown above the workspace.
- Per-window tab count shown in the window header.
- Per-group and Ungrouped tab count shown in group headers.

## Autosave
- Auto-saves to localStorage while editing.
- Clear LocalStorage button removes the autosave snapshot.
