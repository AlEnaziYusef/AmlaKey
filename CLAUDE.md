# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Amlakey (أملاكي) is a cross-platform property management app for landlords in Saudi Arabia, built with React Native + Expo (SDK 54). It targets iOS, Android, and Web (deployed on Vercel as SPA).

## Commands

- **Dev server:** `npm start` (Expo dev server)
- **Platform-specific:** `npm run ios`, `npm run android`, `npm run web`
- **Lint:** `npm run lint` (ESLint via `expo lint`)
- **Web build:** `npm run build:web` (exports to `dist/`)
- **No test suite** — there are no tests configured in this project

## Architecture

### Routing (Expo Router, file-based)

- `app/_layout.tsx` — Root layout with all context providers
- `app/(tabs)/` — Main tab navigation: dashboard (index), properties, expenses, profile
- `app/property/[id].tsx` — Dynamic property detail
- `app/auth.tsx`, `app/landing.tsx` — Auth and marketing landing (web)
- Modal-style routes: `paywall`, `ejar-import`, `reports`, `performance`

### State Management (React Context, no Redux)

All contexts live in `context/`:
- **AuthContext** — Supabase auth, session persistence via AsyncStorage
- **LanguageContext** — English/Arabic i18n with RTL support (~67KB translation dictionary inline)
- **ThemeContext** — Dark/light mode, persisted to AsyncStorage
- **SubscriptionContext** — RevenueCat in-app purchases (free tier: 3 properties, 5 units)
- **NotificationContext** — Local push notifications and notification center

### Backend (Supabase)

- `lib/supabase.ts` — Single Supabase client; uses AsyncStorage for session, detects URL sessions on web
- Environment vars: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- Edge Functions in `supabase/functions/`: `sec-bill` (electricity), `nwc-bill` (water), `push-notify`

### Platform-Specific Files

Several components have `.web.tsx` variants alongside their native `.tsx` counterpart:
- `BiometricGate`, `SwipeableRow`, `haptic-tab` — different implementations per platform
- `NotificationContext`, `SubscriptionContext` — web stubs vs native implementations
- `lib/backup.ts` / `lib/receiptGenerator.ts` — native file system vs web download approaches

### Key Libraries

- `lib/dateUtils.ts` — Gregorian/Hijri calendar conversion, lease period calculations
- `lib/expenseCategorizer.ts` — AI-style expense auto-categorization
- `lib/storage.ts` — User-scoped AsyncStorage keys (prefixed with user ID)
- `lib/sec.ts`, `lib/nwc.ts` — Saudi utility bill integration (SEC electricity, NWC water)

### UI Patterns

- `components/WebContainer.tsx` — Responsive layout wrapper, exports `useResponsive` hook
- `constants/theme.ts` — Color tokens, spacing, typography, shadow utilities
- Desktop web uses a collapsible sidebar; mobile uses bottom tabs
- RTL layout support throughout (Arabic is RTL)

### Subscription / Monetization

RevenueCat (`react-native-purchases`) with feature flags checked via `SubscriptionContext`. Web version has a separate stub that defaults to free tier behavior.

## Obsidian Memory

Claude's persistent memory lives in `~/Documents/Obsidian Vault/Claude Memory/`. Read from and write to this folder to remember things across conversations.

- `User/` — User profile, preferences, expertise
- `Projects/` — Ongoing work, goals, decisions
- `Feedback/` — Behavioral guidance (what to do / avoid)
- `References/` — External resource pointers

At the start of a conversation, check relevant memory files. When you learn something worth remembering, write it as a markdown file with `tags: [claude-memory]` frontmatter. The user can browse and edit memories in Obsidian.

## Agent Routing

Before starting any task, automatically select the best specialist agent from `~/.claude/agents/`. Read the full agent file and adopt its persona, expertise, and approach for the task.

Use `~/.claude/agents/router.md` for the full catalog of available agents and routing instructions.
