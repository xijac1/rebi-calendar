Implementation Overview – Phase 1: Add Supabase Auth



1. Install Supabase packages – added npm install @supabase/supabase-js @supabase/ssr zod react-hook-form @hookform/resolvers
   
2. Create environment‑variable template (.env.local.example) with NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY.

   
3. Set up Supabase client – a supabaseClient.ts that creates a client for both server and client contexts using createBrowserSupabaseClient (client) and createServerSupabaseClient (server).

4. Add auth helpers – a supabaseAuth.ts file exposing useSupabaseAuth hook, sign‑up/sign‑in functions, and a requireAuth server‑side wrapper to protect routes.

5. Create UI pages
- /app/login/page.tsx – sign‑in form (email/password + Google provider).
- /app/signup/page.tsx – sign‑up form (email/password).
- /app/dashboard/page.tsx – protected dashboard showing the list of user calendars (placeholder for now).

1. Protect the main schedule UI – wrapped ScheduleApp with requireAuth in a new app/schedule/page.tsx that redirects unauthenticated users to /login.


2. Add a simple navigation bar to the layout (app/layout.tsx) with login/logout links based on session state.
All changes compile, and the app now requires Supabase authentication before accessing any schedule functionality. Further steps (calendar CRUD, storing tasks) will build on this authenticated foundation.


no time just checklist