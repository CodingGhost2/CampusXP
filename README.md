# Campus XP

A gamified study planner built with Expo + React Native + Supabase.

Campus XP helps students turn learning goals into actionable tasks, upload proof of work, complete quizzes, and earn XP as they progress through skill paths.

## What This Project Demonstrates

- Mobile-first app architecture with Expo Router
- Authentication and data persistence with Supabase
- Server-state management with TanStack Query
- AI-assisted task generation from goals/documents
- A skills/XP progression model for learning motivation

## Core Features

- **Auth flow**: sign up/sign in/sign out with Supabase Auth
- **Task management**: create, complete, delete, and refresh tasks
- **Proof upload**: attach image/document proof to tasks
- **AI task generation**: generate tasks from a text goal or uploaded syllabus document
- **Quiz rewards**: complete quizzes tied to tasks to earn bonus XP
- **Skill progression**: visualize unlockable skills and progress per learning path
- **Profile stats**: track XP and completed tasks

## Tech Stack

- **Framework**: Expo SDK 54, React Native, Expo Router
- **Language**: TypeScript
- **Backend**: Supabase (Auth, Postgres, Storage)
- **State/Data**:
  - TanStack Query (server state + cache invalidation)
  - Zustand (lightweight app state synchronization)
- **Media/Files**: `expo-image-picker`, `expo-document-picker`, `expo-file-system`

## App Structure

Key directories:

- `app/` - file-based routes (screens and navigation groups)
- `components/` - reusable UI building blocks
- `contexts/` - auth context and session lifecycle
- `hooks/` - query/mutation hooks for app workflows
- `lib/api/` - Supabase and AI data-access functions
- `providers/` - app-level providers (React Query)
- `stores/` - Zustand store models
- `utils/` - environment parsing and Supabase client setup
- `supabase/` - Supabase local config and edge function-related files

Main screens:

- `app/(auth)/sign-in.tsx`
- `app/(app)/index.tsx`
- `app/(app)/todo.tsx`
- `app/(app)/add-task.tsx`
- `app/(app)/rewards.tsx`
- `app/(app)/profile.tsx`

## Setup

### 1) Install dependencies

```bash
npm install
```

### 2) Configure environment variables

Copy `.env.example` to `.env` and set values:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_SUPABASE_STORAGE_BUCKET` (default: `task-proofs`)
- `EXPO_PUBLIC_AI_GATEWAY_URL` (optional, required for AI generation)

### 3) Apply database SQL in Supabase

Run the SQL files in your Supabase SQL editor as needed by your phase:

- `Docs/Supabase-phase2-schema.sql` (base schema)
- `Docs/Supabase-phase6-skill-tree.sql` (skill-tree progression)

### 4) Start the app

```bash
npx expo start
```

Optional targets:

```bash
npm run android
npm run ios
npm run web
```

## Security Notes

- Never commit `.env` or private keys.
- Only `EXPO_PUBLIC_*` values are read by the app bundle.
- Keep provider secrets off-device; use server-side gateways/edge functions.
- AI generation should call a safe gateway endpoint, not a raw provider secret from the client.

## Scripts

- `npm run start` - start Expo dev server
- `npm run android` - open Android target
- `npm run ios` - open iOS target
- `npm run web` - open web target
- `npm run lint` - run Expo lint
- `npm run test` - run Jest tests

## Interviewer Quick Walkthrough

If you are reviewing this project, start here:

1. `app/_layout.tsx` (route protection + providers)
2. `contexts/AuthContext.tsx` (session lifecycle)
3. `hooks/use-campus-queries.ts` (app data flow + mutations)
4. `app/(app)/todo.tsx` and `app/(app)/add-task.tsx` (main user workflows)
5. `app/(app)/rewards.tsx` (skill progression model)

## Current Status

This repository is actively evolving through feature phases.
Some features depend on specific SQL migration files and environment setup, especially AI generation and skill-tree progression.
