# Developer Guide — Daily Tracker

This document describes every architectural decision made during the refactor
and exactly what a developer must do to build the app locally in Xcode.

---

## 1. Display Mode — Absolute vs Percentage

### What changed
| File | Change |
|---|---|
| `mobile/src/lib/database/types.ts` | Added `DisplayMode = 'absolute' \| 'percentage'` type; added `displayMode` field to `AppSettings`; added `BackupFrequency` type and `backupFrequency`, `backupEmail`, `lastBackupDate` fields |
| `mobile/src/lib/database/db.ts` | DB migration adds `display_mode`, `backup_frequency`, `backup_email`, `last_backup_date` columns to the `settings` table; `getSettings()` and `updateSettings()` read/write all new fields |
| `mobile/src/lib/state/data-layer.ts` | Added `useDisplayMode()`, `normalizeDisplayValue()`, `useNormalizeValue()`, `useDisplayUnit()` |
| `mobile/src/app/settings.tsx` | Added segmented control (Absolute / Percentage) in the Appearance section |

### Why conversion must not happen in UI components
UI components are pure renderers. If conversion logic were inside a chart or
table component, every new screen would need to duplicate or import that logic,
making it impossible to change the conversion rule in one place. The data layer
(`data-layer.ts`) is the single normalisation point. Components call
`useNormalizeValue(totalDays)` to get a bound converter function and
`useDisplayUnit()` to get the suffix (`""` or `"%"`).

### Which data layer is responsible
`mobile/src/lib/state/data-layer.ts`:
- `useDisplayMode()` — reads the persisted setting from the DB via React Query.
- `normalizeDisplayValue(rawCount, totalDays, mode)` — pure function, no hooks,
  usable outside React (e.g. in export utilities).
- `useNormalizeValue(totalDays)` — memoised hook for components.

---

## 2. Background & Download Logic

### Current state
The app is **fully offline-first**. All data lives in a local SQLite database
(`personal-tracker.db` via `expo-sqlite`). There is no server fetch for app
data. The backend (`backend/`) is a stub Hono server not used by the mobile app.

The Vibecode live-preview environment (not the app itself) hot-reloads the JS
bundle every time a file changes. This is handled by the `@vibecodeapp/sdk`
package. It has **no runtime effect** in a compiled Xcode build.

React Query cache invalidation times:
- `allDailyEntries`: `staleTime: 30 s` — triggers a re-read from SQLite, not a
  network call.
- `settings`, `activeUser`, `customSports`: `staleTime: 5 min`.

### State machine for backup (new)
File: `mobile/src/lib/utils/backup-scheduler.ts`

```
idle → generating → sharing → done
                 ↘ error
```

| State | Meaning |
|---|---|
| `idle` | No backup in progress |
| `generating` | Reading DB + writing CSV to `FileSystem.cacheDirectory` |
| `sharing` | Native share sheet is open |
| `done` | Share completed; `last_backup_date` written to DB |
| `error` | Something failed; logged, not thrown |

Re-download is re-enabled only by:
1. Manual tap of "Backup Now" in Settings → calls `runBackupNow()`.
2. App launch after the due date — `checkAndRunScheduledBackup()` in `_layout.tsx`.

The scheduler is **not** a background fetch job. It runs only when the app is
foregrounded, which avoids `expo-background-fetch` permission complexity.

---

## 3. Variable–Counter Name Synchronisation

### How it works now (already correct)
`custom-variables-store.ts` stores every variable keyed by a **stable UUID-style
ID** (`custom_<timestamp>_<random>`). The `label` field is the display name.

All consumers look up the label at render time via:
```ts
useVariableLabel(id)      // selector: s.variables[id]?.label ?? id
useVariableLabelMap()     // { [id]: label } for bulk lookups
```

When `updateVariableLabel(id, newLabel)` is called, Zustand updates the store
and all subscribed components re-render with the new label automatically.
**No observer or event bus is needed** — Zustand's reactive store is the
single source of truth.

### Why name-based coupling is avoided
The SQLite column for a custom variable is named `cv_<sanitised-id>`, not
`cv_<label>`. Label changes therefore never require a schema migration.
The `custom_variables_meta` table stores `(id, column_name)` pairs so the
column can always be resolved from the stable ID.

---

## 4. Dynamic Variables — Export, Stats & Charts

### Export schema
`mobile/src/lib/utils/import-export.ts` — `entriesToCSV()` / `entriesToFullCSV()`
accept a `VariableLabels` object built from the current Zustand store state.
Custom variables are included via `getAllCustomVariableValues()` in `db.ts`,
which queries all registered columns in `custom_variables_meta`.

**Adding a new variable automatically:**
1. `addVariable(label, color, type)` in `custom-variables-store.ts` creates the
   store entry and returns the new `id`.
2. `addCustomVariableColumn(id)` in `db.ts` runs `ALTER TABLE daily_entries ADD
   COLUMN "cv_<id>"` and inserts a row into `custom_variables_meta`.
3. On the next export call the new column is included because `entriesToFullCSV`
   reads `customVarColumns` from the meta table dynamically.

### Statistics & Charts
- Statistics: `calculateStatistics()` in `calendar-utils.ts` accepts a
  `FilterOption[]`. Custom variables appear in the filter list when the
  calling screen maps `useAllVariables()` to `FilterOption` entries.
- Charts: `isFieldActive()` and `calculateFieldData()` in `calculations.ts`
  handle custom variables via the `customVarData` / `columnName` parameters
  passed by the graphs screen.

No hardcoded list of variable IDs exists in any chart or stats component.

---

## 5. Backups & Scheduled Exports

### Files
| File | Role |
|---|---|
| `mobile/src/lib/utils/backup-scheduler.ts` | All scheduling and file-generation logic |
| `mobile/src/app/settings.tsx` — `BackupSection` | UI: frequency selector, email field, "Backup Now" button |
| `mobile/src/app/_layout.tsx` | Calls `checkAndRunScheduledBackup()` on launch |

### No server dependency
- Export is generated by `entriesToCSV()` from local SQLite data.
- The file is written to `FileSystem.cacheDirectory` (ephemeral, not synced).
- Delivery uses `expo-sharing` (native share sheet). The user selects their
  email client, AirDrop, iCloud Drive, etc.
- `backupEmail` is stored in settings as a hint to pre-fill the "To" field, but
  the app never sends email directly.

### Offline behaviour
The entire backup pipeline works with no network. If `Sharing.isAvailableAsync()`
returns false (e.g. simulator with no apps), the function returns early with
`state = 'error'`.

### Disabling the scheduler
Set `backupFrequency = 'none'` in Settings. `isBackupDue()` returns false
immediately and no file is generated.

---

## 6. Xcode Compatibility — Steps to Prepare

The following must be done **before** opening the project in Xcode:

### Remove Vibecode runtime packages

```bash
cd mobile
bun remove @vibecodeapp/sdk
```

In `backend/`:
```bash
cd backend
bun remove @vibecodeapp/backend-sdk @vibecodeapp/cloud-studio @vibecodeapp/proxy
```

Also delete or empty `backend/src/lib/vibecode.ts` and remove the proxy import
from `backend/src/index.ts`.

### Remove Vibecode CORS allowlist from backend
In `backend/src/index.ts`, the CORS `origin` array includes
`*.dev.vibecode.run` and `*.vibecode.run`. Replace with your own domains or
remove entirely if the backend is not used.

### Environment variables
The Vibecode platform injects `.env` values at build time. For local builds:

1. Copy `.env.production` to `.env.local`.
2. Fill in values. Keys that must be set:
   - `BACKEND_URL` in `backend/.env`
   - Any API keys used by the app (none currently required for core features).
3. Expo reads `.env` automatically via `expo-constants`.

### Files to remove/replace for a standalone build

| File/Package | Action |
|---|---|
| `@vibecodeapp/sdk` in `mobile/package.json` | `bun remove` |
| `@vibecodeapp/backend-sdk` in `backend/package.json` | `bun remove` |
| `@vibecodeapp/proxy` in `backend/package.json` | `bun remove` |
| `backend/src/lib/vibecode.ts` | Delete or replace with a no-op |
| `mobile/src/lib/useColorScheme.web.ts` | Keep — needed for web target only |
| `mobile/src/lib/database/db.web.ts` | Keep — stub for web target |

### Code paths that differ between Vibecode and local build

| Path | Vibecode | Local Xcode |
|---|---|---|
| Hot reload | Handled by `@vibecodeapp/sdk` proxy | Standard Metro bundler |
| Env vars | Injected by platform | Read from `.env` file |
| CORS | Allows `*.vibecode.run` | Restrict to your domain |
| Backend proxy | `@vibecodeapp/proxy` wraps Hono | Remove proxy, expose Hono directly |

---

## 7. Offline-First Architecture

### Folder structure (mobile)

```
mobile/src/
  app/              — Expo Router screens (no server calls)
  components/       — Pure UI components (no data fetching)
  lib/
    database/       — SQLite schema, migrations, CRUD (db.ts)
    state/          — Zustand stores (persisted) + React Query hooks
    utils/          — Stateless utilities: import-export, backup-scheduler,
                       calendar-utils, date-utils
    charts/         — Pure chart calculation functions
```

### Assets vs mutable data

| Category | Storage | Bundled? |
|---|---|---|
| App code | Compiled into binary | Yes |
| Daily entries | SQLite on device | No (user data) |
| Settings | SQLite on device | No |
| Zustand stores | AsyncStorage on device | No |
| CSV exports | `FileSystem.cacheDirectory` | No (ephemeral) |
| Icons / images | Bundled via `expo-asset` | Yes |

### After download — no Vibecode dependency
Once the Xcode binary is built:
- The app never contacts `vibecode.run` or `proxy.vibecodeapp.com`.
- All reads and writes go to the local SQLite file.
- Backups use the native share sheet only.
- The backend is not required for any mobile feature.

### GitHub as single source of truth
All logic lives in this repository. The Vibecode platform is only a development
environment (live preview + deploy). Treat it like a cloud IDE — the code is
always the authoritative artifact.

---

## 8. Summary of All File Changes

### New files
| File | Purpose |
|---|---|
| `mobile/src/lib/utils/backup-scheduler.ts` | Backup state machine + CSV share logic |
| `DEVELOPER.md` | This document |

### Modified files
| File | What changed |
|---|---|
| `mobile/src/lib/database/types.ts` | Added `DisplayMode`, `BackupFrequency` types; extended `AppSettings` with 4 new fields; updated `DEFAULT_SETTINGS` |
| `mobile/src/lib/database/db.ts` | DB migrations for 4 new columns; `getSettings()` reads them; `updateSettings()` writes them |
| `mobile/src/lib/state/data-layer.ts` | Added `useDisplayMode`, `normalizeDisplayValue`, `useNormalizeValue`, `useDisplayUnit` |
| `mobile/src/app/settings.tsx` | Added `BackupFrequency`, `AppSettings`, `DisplayMode` imports; `BackupSection` component; display-mode segmented control in Appearance; `BackupSection` rendered before Data Deletion section |
| `mobile/src/app/_layout.tsx` | Added `checkAndRunScheduledBackup` call on launch |
| `mobile/src/lib/utils/import-export.ts` | Made header validation non-fatal (falls back to static column map) so old CSV exports can always be re-imported |

### Dependencies to remove before Xcode build
```
mobile:  @vibecodeapp/sdk
backend: @vibecodeapp/backend-sdk  @vibecodeapp/cloud-studio  @vibecodeapp/proxy
```
