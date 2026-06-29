# Technology Plan: Multi-Calendar Study Planning App

  ## Summary

  Build this first as a web app using Next.js + TypeScript + Supabase. This gives the
  fastest path from the current static prototype to a real app where users can log in,
  create multiple calendars/projects, save tasks, rebalance schedules, and later import
  tasks from external APIs.

  Target Markdown file when implementation is allowed: TECHNOLOGY_PLAN.md.

  ## Recommended Stack

  - Frontend: Next.js, React, TypeScript
  - Styling: Tailwind CSS + shadcn/ui
  - Backend/Auth/Database: Supabase
  - Database: Supabase Postgres
  - Auth: Supabase Auth with email/password and optional Google login
  - Hosting: Vercel for the web app, Supabase hosted backend
  - Date Logic: date-fns
  - Forms/Validation: React Hook Form + Zod
  - Server Logic: Next.js Server Actions or API routes
  - Future API Imports: Next.js API routes plus Supabase tables for import sources/import
    logs

  ## Core App Architecture

  - Convert the current static HTML/CSS/JS prototype into a Next.js app.
  - Keep the rebalance algorithm in a reusable TypeScript module so it can be tested
    separately from the UI.

  - Add Supabase login so every user owns their own calendars and tasks.
  - Support unlimited user-created calendars for different projects, classes, exams,
    subjects, or personal goals.

  - Store tasks in Postgres instead of in-memory JavaScript.
  - Use Supabase Row Level Security so users can only access their own data.

  ## Initial Data Model

  Minimum tables:

  - profiles
      - id
      - email
      - created_at

  - calendars
      - id
      - user_id
      - name
      - description
      - start_date
      - due_date
      - default_view
      - created_at
      - updated_at

  - tasks
      - id
      - calendar_id
      - title
      - subject
      - duration_minutes
      - scheduled_date
      - completed
      - source
      - created_at
      - updated_at

  - calendar_days_off
      - id
      - calendar_id
      - date

  - import_sources
      - id
      - calendar_id
      - provider
      - config
      - enabled
      - created_at

  - import_logs
      - id
      - calendar_id
      - provider
      - status
      - message
      - created_at

  ## Feature Roadmap

  ### Phase 1: Real Web App Foundation

  - Create a Next.js app with TypeScript.
  - Move the existing schedule UI into React components.
  - Add Supabase Auth.
  - Add protected routes for logged-in users.
  - Add dashboard page showing all calendars.
  - Add create/edit/delete calendar flows.
  - Save tasks, completion state, dates off, and calendar settings in Supabase.

  ### Phase 2: Calendar + Task Features

  - Add task CRUD: create, edit, delete, complete, uncomplete.
  - Add multiple calendar views: weekly first, then daily/monthly.
  - Add subject labels/colors per calendar.
  - Keep task duration required because rebalancing depends on it.
  - Add calendar-specific settings: start date, due date, days off, default view.
  - Make the Rebalance button update only unfinished tasks.

  ### Phase 3: Rebalance Engine

  - Extract rebalance logic into a pure TypeScript function.
  - Inputs: tasks, start date, due date, days off.
  - Output: updated scheduled dates for unfinished tasks.
  - Keep completed tasks fixed.
  - Skip days off.
  - Balance by duration_minutes, not task count.
  - Aim to minimize the heaviest day while keeping workload spread across available dates.

  ### Phase 4: Imports and Integrations

  - Add CSV import first because it is simple and useful.
  - Add API import framework after the core app is stable.
  - Store external provider configs in import_sources.
  - Store import history/errors in import_logs.
  - Normalize imported tasks into the same tasks table.
  - Possible future providers: Google Calendar, Notion, Canvas, Todoist, custom API/
    webhook.

  ## Testing Plan

  - Unit test the rebalance algorithm:
      - evenly distributes unfinished tasks by duration
      - skips days off
      - keeps completed tasks fixed
      - handles invalid or missing durations
      - handles too few available days
      - handles empty calendars

  - Integration test Supabase policies:
      - users can read/write only their own calendars
      - users cannot access another user’s tasks
      - calendar deletion removes or archives related tasks correctly

  - UI test core flows:
      - sign up/login/logout
      - create calendar
      - add task with required duration
      - mark task complete
      - rebalance calendar
      - add days off
      - switch between calendars

  ## Assumptions

  - Build as a web app first.
  - Use Supabase for auth, database, and backend services.
  - Use Next.js + TypeScript instead of continuing with plain HTML/CSS/JS.
  - Use Vercel for deployment.
  - Start with one-user-private calendars only; sharing/collaboration can be added later.
  - API importing is a future feature, so the first version should prepare the data model
    without building every integration immediately.

