# Daily Personal Tracker

A comprehensive daily personal tracking iOS application designed for offline, long-term daily use with local-only storage, editable historical data, accurate statistics, and full export functionality.

## Navigation (Catalan)

All screens use Catalan labels:
- **Afegir dada** — Data Entry
- **Estadístiques** — Statistics / Calendar
- **Gràfics** — Graphics / Charts
- **Configuració** — Settings
- **Resum dades** — Summary Metrics (inside Gràfics)

## Features

### Core Functionality
- **100% Offline** - Works without internet connection
- **Local SQLite Storage** - All data stored on device
- **User Profiles** - First-launch setup with user name
- **Fast & Reliable** - Optimized for daily use
- **Editable History** - Click any calendar day to edit past entries
- **Beautiful Design** - Modern dark theme iOS-native design

### Home Screen
- Personalized greeting with user name
- Total days tracked counter
- Today's status indicator (Saved/Not set)
- Quick navigation to all features:
  - **Data Entry** - Log daily activities
  - **Statistics** - View calendar, filters, and charts
  - **Graphics** - Cumulative graphs and time-series analysis
  - **Settings** - Customize app behavior and colors

### Data Entry

#### Counter
- **Counter field (0–25)** - Numeric stepper for daily count
- Increment/decrement buttons with quick-select shortcuts (0, 5, 10, 15, 20, 25)
- Existing entries keep `null` (displayed as 0); new entries store 0–25
- Stored in `counter` column in the database

#### Sleep Tracking (Same-Day Model)
- **Wake-up Time (today)** - Time you woke up this morning (displayed first)
- **Sleep Quality** rating (1-10) (displayed second)
- **Bedtime (today)** - Time you went to bed tonight (displayed last)
- **Slept Hours** - Automatically calculated from previous day's bedtime + current day's wakeup
- Slept hours displayed in **HH:MM format** (e.g., 08:30 = 8 hours 30 minutes)
- **Defensive time handling** - Validates and clamps all time values

> **Sleep Data Model**: Each day stores when you woke up (this morning) and when you went to bed (tonight). The app calculates total slept hours by combining yesterday's bedtime with today's wake-up time. Field order: Wakeup → Sleep Quality → Bedtime.

#### Work Status (Multi-Selection Allowed)
- Worked at Job (Blue) - Can be selected independently
- Worked at Home (Orange) - Can be selected independently
- **Both options can now be selected simultaneously**

#### Missed Objectives (Boolean Flags)
- **Fum** - Marks day as RED (highest priority)
- **Gat** - Marks day as PINK

#### Activities (Option C - Blue when active)
- Meditation
- Yoga
- Dibuix
- **Llegir** (new) - Reading activity
- All can be selected together

#### Sports (Option D - Blue when active)
- Default sports: Exercise, Running, Swimming, Cycling, Yoga, Weightlifting
- Add custom sports with free text input
- Multiple sports can be logged per day
- Delete sports via "Manage Sports" modal

#### Notes
- Free-text notes field
- Keyboard-aware scrolling (text always visible above keyboard)
- Editable and deletable

### Statistics Screen (Estadístiques)

Colors of calendar day cells now respect user-selected colors from Configuració:
- RED cell uses the user's Fum color
- PINK cell uses the user's Gat color
- GREEN/YELLOW cells use fixed green/yellow colors

All labels in Catalan: Resum, Esports, Qualitat del son, Hores dormides, Rang de temps, etc.

#### Time Range Selection (Single Source of Truth)
- **Unified time range selector** - Controls all data views
- **Redesigned labels** - Split into two lines (number + unit) for better fit
- Explicit start/end date boundaries
- Timeframe options: 1 wk, 15 day, 1 mo, 3 mo, 6 mo, 1 yr, **All** (shows entire dataset)
- **Month-aware anchoring** - When viewing past months, statistics calculate from the last day of that month backwards
- All summary metrics, sports bars, and graphs use the same filtered dataset
- Date range displayed clearly below selector

#### Calendar View
- Monthly calendar with Monday as the first day
- Clickable days to edit entries for any date
- Color coding based on activities:
  - **RED** - Fum active (highest priority)
  - **PINK** - Gat active (second priority)
  - **BLUE** - Option C (Activities) + Option D (Sports) active, but NOT Option A (Work)
  - **GREEN** - All three categories active (Work + Activities + Sports)
  - **YELLOW** - Any two of three categories active
  - **NEUTRAL** - Default/no data

#### Multi-Sport Calendar Filtering
- **Independent boolean filters** per sport and activity
- Multiple simultaneous sport selections supported
- Filters grouped by Activities and Sports categories
- **Color-blind safe palette** - High contrast, accessible colors
- When filters are active:
  - Calendar shows colored dots for filtered items
  - Multiple filters = multiple dots per day
- Available filters: Work (Job), Work (Home), Fum, Gat, Meditation, Yoga, Llegir, Any Sport, + individual sports

#### Graph Rendering Order
1. **Summary** - Progress bars for activities (Worked at Job, Worked at Home, Fum, Gat, Meditation, Yoga)
2. **Sports** - Progress bars for each sport (sorted by frequency)
3. **Sleep Quality** - Line chart
4. **Slept Hours** - Line chart (purple)
5. **Counter** - Line chart (amber/gold) showing daily counter values (0–25)

#### Counter Chart (NEW)
- Line chart showing daily counter values (0–25)
- Amber/gold color scheme (#f59e0b) to distinguish from other charts
- Only connects days that have recorded data (no interpolation)
- Shows Average, Best, Lowest, and Days count statistics
- Interactive line chart showing sleep quality trend
- Positioned at the bottom of the statistics view
- Modern design with X and Y axes
- Shows date range and statistics: Average, Best, Lowest, Days count
- **Improved average calculation** - Excludes null and 0 values (invalid data)
- **Sleep quality values in calendar** - Black text at 80% opacity for readability
- Handles empty datasets safely

#### Slept Hours Chart (ENHANCED)
- Interactive line chart showing sleep duration trend
- Displays slept hours in **HH:MM format** (e.g., 08:30)
- Purple color scheme (#8b5cf6) to distinguish from Sleep Quality chart
- **Dynamic Y-axis range** - Min = minimum sleep value minus 1 hour, Max = maximum sleep value plus 1 hour
- **Y-axis labels always visible** with "h" suffix (e.g., "7h", "8h")
- Shows statistics: Average, Dormilega (most), Nit del Lloro (least), Days count
- All time displays in HH:MM format
- Calculated from previous day's bedtime + current day's wakeup
- **Missing data handling** - Lines break when data is missing (no interpolation)

### Graphics Screen / Gràfics (ENHANCED - Major Refinement)

#### Derivative Graph (Taxa de canvi) – Corrected Logic
- **No negative slopes ever** — if next_value < current_value, that point is treated as "no data" (null)
- Month resets (accumulated going back to 0) do NOT produce negative slopes
- The derivative graph minimum is always 0
- Interval selector: 1d, 3d, 7d

#### Graph Viewer (Redesigned)
- **Multi-variable plotting** - All selected fields plotted simultaneously on the same graph
- **Sleep quality excluded** - This view is for cumulative activity tracking only
- **Visible X/Y axes** - Always visible and readable with proper labels
- **Custom date range** - Full flexibility with start/end date pickers
- **Fullscreen mode** - Tap graph or maximize button for landscape view
- **Line breaks for missing data** - No interpolation; lines resume when data available
- **Time range integration** - Subscribes to the same centralized time range selector
- **Tap tooltip** - Tap any chart point to see the exact value in a tooltip
- **Redesigned range selector** - Clean pill/segmented control, evenly spaced, full width

#### Graph Modes (NEW)
- **Accumulated mode** - Cumulative sum across the selected period (original behavior)
  - Slope = total / registered days
- **Monthly mode** - Resets accumulation on the 1st of each month
  - Two lines shown simultaneously: monthly-reset line + overall accumulated line
  - Per-month breakdown in the Summary Metrics section (days on, per-day slope)
  - Toggle between modes with the "Accumulated / Monthly" pill toggle above the chart

#### Summary Metrics (per selected field)
- **Total occurrences** in the selected period
- **Slope value** - Total divided by registered days (not total days)
- **Registered days** - Count of days with actual data

#### Trackable Fields (Cumulative Only)
- **Boolean Activities**: Worked at Job, Worked at Home, Fum, Gat, Meditation, Yoga, Dibuix, Llegir
- **Array Fields**: Sports (any sport occurrence)
- **No limit** on simultaneous selection

#### Multi-Field Selection
- Select multiple cumulative fields to compare trends
- Each field displayed with distinct color from color-blind safe palette
- Visual chips showing all selected fields

#### Aggregation Rules
- **Boolean/Array fields**: Cumulative count over time
  - Each occurrence increments by 1
  - Graph shows running total
  - Lines break when data is missing (no interpolation)

### Settings Screen

#### Appearance
- **Theme Selection** - Light, Dark, Midnight, Forest, Ocean
- **Calendar Style** - Default, Minimal, Compact, Detailed
- **Summary Display** - Percentages, Progress Bars, Numbers, Donut Charts

#### Activity Colors (NEW)
- **Custom color configuration** for each activity
- Colors applied to graphs and calendar filters
- **Color-blind safe palette** - 8 high-contrast colors
- Reset to defaults option

#### Notifications (Fixed)
- Toggle daily reminders on/off
- Morning reminder time (configurable)
- Evening reminder time (configurable)
- **Auto-reschedule on app launch** - Notifications persist reliably
- Requires device permissions

#### Data Export & Import

**Export System (ENHANCED - Triple Export)**
- **Full Dataset Export (CSV)**
  - All fields: Date, Wakeup, Bedtime, SleepQuality, activities, sports, notes
  - CSV-safe formatting with proper quote handling
  - **Sorted newest-first** (descending by date)
- **Data Only Export (CSV)** (NEW)
  - All fields EXCEPT Notes
  - Perfect for data backup without personal journal entries
  - **Sorted newest-first** (descending by date)
- **Notes-Only Export (CSV)**
  - Date and Notes columns only
  - No derived fields or formatting changes
  - Only includes entries with notes
  - **Sorted newest-first** (descending by date)
- **JSON Export** - Complete backup format (newest-first)
- **Plain Text Export** - Human readable summary (newest-first)

**Import System (ENHANCED - Dual Import with Note Preservation)**
- **Button 1: Import Data (No Notes)**
  - Imports all fields EXCEPT Notes
  - Even if CSV has a Notes column, it is ignored
  - Existing notes remain unchanged
  - **Conflict Detection** - Identifies dates that already exist
  - **Replace/Skip/Cancel Dialog** - User chooses how to handle conflicts
- **Button 2: Import Only Notes**
  - Updates ONLY the Notes field
  - If note exists, replaces it
  - If entry doesn't exist, creates entry with only date and notes
  - If CSV does NOT have a Notes column, no changes are made
  - No other fields may be modified
- **Six Templates Available**
  - Full Export, Data Only Export, Notes Only Export
  - Full Import, Data Only Import, Notes Only Import
  - All downloadable from the Templates modal in Settings
- **Validation Guarantees**
  - Stable schema - no implicit changes
  - Deterministic imports/exports
  - Reversible transformations
  - No hidden background cleanup
  - No automatic "fixing" of data
  - Every transformation is explicit and traceable
- **Import Formats:**
  - JSON and CSV supported
  - XLSM/XLSX detection with clear conversion instructions
  - Sports field handling: comma-separated format (e.g., "Running, Yoga")
  - Detailed import results: imported count, replaced count, skipped count, errors, warnings
- **Download Template:**
  - CSV template with complete instructions
  - 7 consecutive days of example data
  - **Column order**: Date, Wakeup, SleepQuality, Bedtime, then activities
  - **Boolean encoding**: 0/1 format for all boolean fields
  - **Sports format**: Comma-separated without brackets
  - Sleep model clarified - Wakeup=this morning, Bedtime=tonight
  - Schema requirements documented

#### Data Deletion (ENHANCED)
- **Delete Single Day** - Remove individual date records
- **Delete Entire Month** - Remove all records for a selected month/year
  - Month/Year picker with horizontal scrolling
  - Shows entry count before deletion
  - **Double confirmation** - First confirm → Final warning modal
- Deleted dates can be re-imported later

#### App Info
- Storage type: 100% Offline SQLite
- Total entries count
- Version information

## Technical Architecture

### Centralized Data Layer
All data access goes through a single, consistent data layer (`src/lib/state/data-layer.ts`):
- **Unified query keys** - Single source of truth for cache keys
- **Normalized data access** - No duplicated state or implicit global queries
- **React Query hooks** - useAllEntries, useFilteredEntries, useDailyEntry, useSettings, etc.
- **Bulk import support** - useBulkImport with validation and duplicate prevention

### Time Range State Management
Centralized time range store (`src/lib/state/time-range-store.ts`):
- **Explicit boundaries** - startDate and endDate always defined
- **Timeframe presets** - week, month, 6months, year
- **Custom range support** - Override presets with specific dates
- **Zustand selectors** - Optimized re-renders with primitive selectors

### Color Settings Store (ENHANCED)
Persisted color configuration (`src/lib/state/color-settings-store.ts`):
- **Activity colors** - Per-field color customization
- **Color-blind safe defaults** - 8 high-contrast colors
- **AsyncStorage persistence** - Colors survive app restarts
- **Activity pair colors** - Optional override for activity combinations
- **Extreme Value Names** (NEW) - Configurable labels for statistics
  - Sleep time: "Night Owl" / "Morning Bird" (latest/earliest bedtime)
  - Wake time: "Late Riser" / "Early Bird" (latest/earliest wakeup)
  - Sleep duration: "Dormilega" / "Nit del Lloro" (most/least sleep)
  - Sleep quality: "Deep Sleeper" / "Light Sleeper" (best/worst quality)

### Database Layer
- **SQLite** with expo-sqlite
- Tables:
  - `users` - User profiles
  - `daily_entries` - One record per day (with optional user_id)
  - `settings` - App configuration
  - `custom_sports` - User-defined sports
- Automatic schema migration (backward compatible)
- Theme and display style persistence
- **Data validation** on all operations

### Import/Export Module
Dedicated import/export utilities (`src/lib/utils/import-export.ts`):
- **Schema definition** - Explicit field types and validation rules
- **Column mapping** - Flexible header matching (case-insensitive, multiple formats)
- **CSV parsing** - Handles quoted values with commas correctly
- **Validation helpers** - Date, time, boolean, number parsing with safe defaults
- **Sports array parsing** - Handles "", "false", "[]", "exercise", ["exercise"] formats
- **Template generation** - Downloadable CSV with instructions

### UI/UX
- **NativeWind** (Tailwind) for styling
- **Lucide React Native** for icons
- **Victory Native** for charts
- **react-native-keyboard-controller** for keyboard-aware scrolling
- **Haptic feedback** for all interactions
- **Modal-based pickers** - Close only when Done is pressed or clicking outside
- **Safe Area** handling for iOS

### Navigation
- **Expo Router** (file-based routing)
- Stack navigator for main screens
- Data Entry accepts `date` param for editing specific days
- Welcome screen for first-time users

## Screens

1. **Welcome** - First-launch user profile setup
2. **Home** - Personalized greeting, stats cards, navigation
3. **Data Entry** - Full-featured daily logging with modals
4. **Statistics** - Calendar view, filters, charts, summaries
5. **Graphics** - Cumulative graphs and time-series analysis
6. **Settings** - Appearance, colors, notifications, export/import, deletion

## Design Philosophy

- **iOS-native feel** - Follows Human Interface Guidelines
- **Dark theme default** - Serious, professional look
- **One-handed use** - Optimized touch targets
- **Fast entry** - Modal pickers with Done buttons
- **Visual feedback** - Haptics and animations
- **Glanceable** - Quick status overview
- **Defensive programming** - Validates all inputs, fails safely
- **No dead code** - Clean architecture with single data layer
- **Accessibility** - Color-blind safe palette throughout

## Data Persistence

All data is stored locally using SQLite:
- Database file: `personal-tracker.db`
- Location: App's document directory
- Survives app restarts and OS updates
- No cloud sync required
- Fully exportable and importable
- User-scoped data support

## Privacy

- **No internet required** - Works completely offline
- **No data collection** - Zero telemetry or analytics
- **Local storage only** - Data never leaves your device
- **Full control** - Export and delete data anytime

## Tech Stack

- **Expo SDK 53**
- **React Native 0.76.7**
- **TypeScript**
- **SQLite** (expo-sqlite)
- **React Query** (data fetching)
- **Zustand** (time range & color settings state)
- **AsyncStorage** (color persistence)
- **NativeWind** (Tailwind CSS)
- **Victory Native** (charts)
- **Lucide Icons**
- **Expo Notifications** (reminders)
- **react-native-keyboard-controller** (keyboard handling)

---

**Daily Tracker** - Your personal life companion
