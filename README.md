# Gawin

**Focus on today. Gawin.**

Gawin is a minimalist, offline-first task app designed around one simple idea:
keep your attention on what needs to be done today. Past tasks stay out of the
way while remaining available whenever you need them.

The name comes from the Filipino word _gawin_—to do or get something done.

## Features

- A focused home screen that shows only today's tasks
- Task creation, editing, completion, and deletion with undo
- Drag-and-drop ordering and task duplication
- A separate history for browsing tasks from previous dates
- Search across task history
- The option to move unfinished past tasks back to today
- A new-day review for unfinished tasks
- Manageable daily defaults that create one fresh Today task each day
- Repeating schedules for daily, weekday, weekend, or selected-day routines
- Optional local task reminders
- Optional six-digit App Lock with offline recovery and automatic locking
- Minimalist action sheets, toast messages, and tactile feedback
- Preferences for haptics, reduced motion, and backup reminders
- Fully offline storage with no account required
- Installable PWA support for iPhone, Android, and desktop browsers
- Manual JSON backup and restore using files you control
- Safe backup previews with merge and replace options
- A visible last-backup status without automatic uploads

## Privacy and backups

Gawin stores tasks locally on the device and does not require an internet
connection. It does not automatically upload task data to a server.

Backups can be exported as readable JSON files and saved to Files, iCloud
Drive, Google Drive, AirDrop, or another location supported by the device.
During import, Gawin validates and previews the file before making changes.

Because backup files contain task titles, keep them somewhere private.

App Lock is optional in **Settings → Privacy**. Create a six-digit PIN, confirm
it, and save the recovery code outside Gawin before enabling the lock. The app
locks on a fresh launch and after 30 seconds away by default; immediate locking
is also available. Changing or removing the PIN requires the current PIN.
If you forget it, use the saved recovery code to choose a new PIN.

PINs are never stored as plain text. Verification uses salted PBKDF2-SHA256
with 600,000 iterations and persistent retry delays. Native credentials use
SecureStore; the PWA keeps verification records in browser storage. This is an
interface privacy lock, not encryption of task storage. Clearing browser data
can remove the lock and tasks. PINs and recovery credentials are excluded from
task backups, so keep the recovery code separately. Biometric unlock is not
included yet.

Task reminders are scheduled locally. Native builds can deliver them while the
app is closed; browser reminders are best-effort and require the installed PWA
to remain open.

## Built with

- [Expo](https://expo.dev/)
- [React Native](https://reactnative.dev/)
- [Expo Router](https://docs.expo.dev/router/introduction/)
- [TypeScript](https://www.typescriptlang.org/)
- [AsyncStorage](https://react-native-async-storage.github.io/async-storage/)

## Getting started

### Requirements

- [Node.js](https://nodejs.org/)
- [pnpm](https://pnpm.io/)
- Expo Go, an iOS Simulator, or an Android Emulator

### Run locally

```bash
git clone https://github.com/Enitsaj13/gawin.git
cd gawin
pnpm install
npx expo start
```

From the Expo terminal, scan the QR code with Expo Go or select an available
simulator or emulator.

Existing native development builds must be rebuilt after adding the App Lock
dependencies (`expo-crypto` and `expo-secure-store`). The PWA needs no native build.

### Run the web app

```bash
# Start the browser development server
pnpm web

# Create the installable, offline production build
pnpm build:web

# Preview the production build locally
pnpm serve:web
```

The production build is written to `dist/`. Deploy that directory to an HTTPS
host, then open the URL in Safari and choose **Add to Home Screen** to install
Gawin as a standalone web app. The native iOS and Android apps remain part of
the same Expo Router codebase.

### Deploy to Vercel

Import this repository into Vercel or run `npx vercel@latest` from the project
root. The included `vercel.json` runs the PWA build, publishes `dist/`, and
rewrites Expo Router paths to the single-page app entry point. Use the stable
production URL when installing Gawin because browser storage is scoped to its
domain.

## Development commands

```bash
# Start the development server
npx expo start

# Run ESLint
npx expo lint

# Run the TypeScript compiler check
npx tsc --noEmit

# Check the Expo project configuration and dependencies
npx expo-doctor

# Build the offline PWA
pnpm build:web
```

## Project structure

```text
src/
├── app/                 # Expo Router screens and layouts
├── components/          # Shared interface components
├── features/todos/      # Tasks, routines, actions, and backup logic
└── lib/                 # Shared utilities
```

## Design

Gawin uses a restrained monochrome interface, generous spacing, and clear
feedback to keep task management calm and distraction-free. Its primary view
deliberately prioritizes today instead of presenting an overwhelming backlog.
