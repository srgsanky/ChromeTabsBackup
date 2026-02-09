# ChromeTabsBackup Features

## Overview
- Export all open tabs as a Markdown table.
- Export all open tabs and groups as JSON (download with save dialog).
- Import JSON to open tabs in new window(s), preserving groups.

## Export Markdown
- Produces a Markdown table with columns: Name, URL, Tab Group.
- Deduplicates URLs and closes duplicate tabs.
- Copies the table to the clipboard.
- Shows the table in the popup.

## Export JSON
- Generates a JSON snapshot with:
  - `tabs[]` including URL, title, pinned, active, muted, windowId, index, groupId
  - `groups[]` including id, title, color, collapsed, windowId
  - `version` and `generatedAt`
- Downloads as `chrome-tabs.json` using a save dialog.
- Shows the JSON in the popup.

## Import JSON
- Opens tabs in new window(s) to avoid touching the current window.
- If multiple `windowId`s exist, creates one Chrome window per `windowId`.
- Recreates tab groups and respects group metadata:
  - title, color, collapsed
- Restores the active tab per window when flagged in JSON.
- Does not perform duplicate detection.
