# Tab Organizer Web App

## Why this exists
This web app makes it easier to **manipulate the tabs JSON** exported by the Chrome extension before importing it again. It provides a visual way to reorder tabs, regroup them, and manage windows without editing raw JSON.

## How to run it
Because modern browsers block module/script loading from `file://`, run a local HTTP server:

```bash
# ChromeTabsBackup/webapp
python3 -m http.server 8000
```

Then open:

```
http://localhost:8000
```

## Notes
- Import/Export are explicit via buttons.
- Autosave is stored in `localStorage` under `ctb.webapp.autosave.v1`.
