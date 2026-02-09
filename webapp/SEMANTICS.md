# Tabs JSON Editor Semantics

## Core Assumptions
- The app edits the same JSON schema as the extension export (`version`, `generatedAt`, `groups[]`, `tabs[]`).
- `tabs[].windowId` decides which window a tab belongs to.
- `tabs[].groupId` is optional; when present it must reference a `groups[].id` in the same window.

## Windows
- Each `windowId` becomes one column in the UI.
- Creating a window adds a new `windowId` to the session.
- Deleting a window removes all tabs and groups that belong to that window.

## Groups
- Groups are scoped to a single window (via `groups[].windowId`).
- Creating a group adds it to the current window.
- Deleting a group deletes all tabs inside the group.
- Moving a group to a different window is not supported directly; move tabs instead.

## Tabs
- Tabs are listed under either a specific group or the Ungrouped section for a window.
- Clicking a tab opens its URL in a new browser tab immediately.
- Clicking Close removes that tab from the JSON.

## Drag-and-Drop Rules
- Dragging a tab within the same group reorders the tab list.
- Dropping a tab into another group moves it to that group.
- Dropping a tab into another window’s Ungrouped section:
  - Updates `tabs[].windowId` to the target window.
  - Clears `tabs[].groupId`.
- Dropping a tab into a group in another window:
  - Updates `tabs[].windowId` to the target window.
  - Sets `tabs[].groupId` to the target group.

## Export Rules
- Export is explicit: JSON is only downloaded when you click Export.
- `tabs[].index` is recomputed per window on export, using the current UI order:
  - Ungrouped tabs first, then each group in the window (top to bottom).
  - Tabs are ordered as shown within each list.
- `generatedAt` is updated to the current time on export.

## Autosave
- Any edit schedules an autosave to localStorage.
- Autosave is only for local recovery and does not modify exported JSON.
