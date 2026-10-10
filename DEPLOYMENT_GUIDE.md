# CONCRETE360: local demo, Vercel, Supabase, and desktop install

## What this package currently does

- Responsive React/Vite app with a light theme by default and a saved light/dark toggle.
- Vercel-ready static frontend with an SPA rewrite.
- Installable Progressive Web App shell for supported desktop and mobile browsers.
- User page grants and role-based UI controls are stored in browser storage.

## Important before using real company data

This code currently stores accounts and operational records in `localStorage`; it does **not** connect to Supabase. That means data is local to each browser/device and is not shared between staff. The current demo login also has a built-in `adminbilgi` fallback. Do not treat the current client-side role checks, stored passwords, or page grants as production security: browser storage can be changed by the person using that browser.

For real multi-user use, connect Supabase Auth and migrate the records to database tables protected by Row Level Security (RLS). Keep the Supabase service-role key on a trusted server only—never put it in Vite code or a `VITE_...` variable.

## 1. Preview the app locally

1. Install Node.js 20.19+ (or 22.12+) and npm.
2. Open a terminal in the folder containing `package.json`.
3. Run:

   ```bash
   npm install
   npm run dev
   ```

4. Open the local URL printed by Vite (normally `http://localhost:3000`).
5. The demo fallback username is `adminbilgi`; it currently accepts any entered password. Use this only for a local demo.
6. To check staff access, open **User Management → Add User**, choose **EMPLOYEE** or **READ_ONLY**, select the permitted pages, save, log out, and sign in as that user. For example, select **Concrete Pumps** and **Trips**, and uncheck **Dashboard** if the user should see only those two tabs. Non-admins can add records only if their role is EMPLOYEE; only ADMIN/SUPER_ADMIN sees edit/delete controls.

## 2. Deploy the frontend to Vercel

1. Extract this ZIP and open the `CONCRETE360-main` folder.
2. Create a GitHub repository and put the **contents** of `CONCRETE360-main` at the repository root (including `package.json`, `src/`, `public/`, and `vercel.json`).
3. Push the code to GitHub. Vercel can deploy a private repository; authorize the Vercel GitHub App to access that repository.
4. In Vercel, choose **Add New → Project**, import the repository, and select the Vite framework preset.
5. Use these build settings:
   - Build command: `npm run build`
   - Output directory: `dist`
   - Install command: `npm install`
   - Root directory: the folder containing `package.json` (leave it as `./` if the files are at repository root).
6. Deploy and open the generated `*.vercel.app` URL. `vercel.json` includes the SPA rewrite used by this app.
7. Add the public project URL and public anon/publishable key to the Vercel project's environment variables (`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`), then redeploy. The included client scaffold reads these values, but the current page components still use browser storage until they are migrated.

## 3. Supabase starter files and setup

This ZIP now includes:

- `.env.example` and a blank, Git-ignored `.env.local` template
- `supabase/config.toml`
- `supabase/migrations/001_initial.sql`
- `supabase/functions/admin-create-user/index.ts`
- `src/lib/supabase.ts` and `src/lib/database.types.ts`
- `src/auth/AuthProvider.tsx`
- `src/services/records.ts`, `sites.ts`, and `profiles.ts`

The migration creates starter `companies`, `profiles`, `sites`, and `app_records` tables. Row Level Security (RLS) scopes data by company and page grant; employees can add records for permitted pages, while only admins can update or delete them. The generic `app_records` table is a bridge for the migration—not a fully normalized database design for every business record.

**Important:** the existing page components, demo login, and user-management screen still use browser storage. Adding these files does not automatically migrate existing browser data or switch those screens to Supabase. Do not use the current app with live company data until you finish that wiring, migrate any needed records, and test with separate admin and non-admin accounts.

### Fast setup in the Supabase dashboard

1. Create a Supabase project. In **Project Settings → API**, copy the Project URL and public anon/publishable key.
2. In the extracted app folder, copy `.env.example` to `.env.local`, then fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Never put a `service_role` key or database password in this file.
3. In Supabase, open **SQL Editor → New query**. Open `supabase/migrations/001_initial.sql` in a text editor, copy its full contents into the query, and select **Run** once. Do not paste `.env` or TypeScript files into SQL Editor.
4. In **Authentication → Users**, create or invite your first admin user. After that user exists, create a company and link the user's Auth UUID to a profile using SQL Editor:

   ```sql
   insert into public.companies (name)
   values ('Your Company Name')
   returning id;
   ```

   Copy the returned company UUID, then run this second query after replacing both UUID placeholders and the username:

   ```sql
   insert into public.profiles (id, company_id, username, role, page_access)
   values (
     'AUTH_USER_UUID',
     'COMPANY_UUID',
     'adminbilgi',
     'SUPER_ADMIN',
     array[
       'dashboard', 'ongoing_site', 'billing', 'total_bill', 'site_tests', 'trips',
       'material_category', 'transit_mixer', 'concrete_pumps', 'mix_design',
       'site_report', 'measurements', 'company_details'
     ]
   );
   ```

5. For local testing, run `npm install` and `npm run dev` in the folder containing `package.json`. The included AuthProvider and services are starting points for wiring the UI; current screens still use their demo/local-storage flow.
6. To deploy the invite function, install/use the Supabase CLI, then run from the app folder:

   ```bash
   npx supabase login
   npx supabase link --project-ref YOUR_PROJECT_REF
   npx supabase functions deploy admin-create-user
   ```

   Supabase Edge Functions use the service-role credential server-side. Never expose it in the browser. Configure Auth email delivery/SMTP before relying on email invitations.
7. In **Vercel → Project → Settings → Environment Variables**, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for the environments you use, then redeploy.
8. Test the database policies with an employee and read-only account before entering live data. RLS is the security boundary; hiding buttons in the UI alone is not sufficient.

### CLI migration alternative

Instead of copying the migration into SQL Editor, you can apply it with the Supabase CLI using `npx supabase link --project-ref YOUR_PROJECT_REF` followed by `npx supabase db push`. Use one migration workflow for the initial setup; do not apply the same migration via both SQL Editor and CLI.

## 4. Install it on a desktop, laptop, tablet, or phone

After the Vercel site is deployed over HTTPS:

- **Windows/macOS/Linux:** open the URL in Chrome or Edge and use the install icon in the address bar, or the browser menu's **Install app** / **Install this site as an app** command.
- **Android:** open it in Chrome and choose **Install app** or **Add to Home screen**.
- **iPhone/iPad:** open it in Safari, tap **Share**, then **Add to Home Screen**.

The install launches a standalone app window. Its cached shell can open offline after a successful online visit, but the current data remains browser-local until the Supabase migration is completed.

## 5. Make the GitHub repository private

1. Open the repository on GitHub and choose **Settings**.
2. Under **General**, scroll to **Danger Zone**.
3. Select **Change repository visibility → Make private**, read the confirmation, and confirm.
4. Check the Vercel GitHub App installation still has access to the now-private repository. If a Vercel deployment stops, grant the app access to that repository and reconnect/re-import it.
5. Remove any real keys or passwords from the repository and rotate them if they were ever committed. Making a repository private does not erase old clones, forks, or copies already downloaded.

Making the repository private does not prevent Vercel from deploying it when Vercel has repository access. Do not commit `.env` files or secrets.
