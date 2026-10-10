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
7. After connecting Supabase later, add only the public project URL and `anon` key to the Vercel project's environment variables (for example `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`), then redeploy. Those variables are not used by this version yet.

## 3. Connect Supabase for real shared data (required for production)

This is an integration step, not something completed by deploying the current ZIP.

1. Create a Supabase project and save the project URL and public `anon` key in your password manager.
2. Enable Supabase Auth (email/password is a straightforward starting point). Replace the current local login and user creation flow with Supabase Auth; do not store passwords in `localStorage`.
3. Design database tables for the app's records, such as sites, invoices, trips, equipment, tests, materials, mix designs, and measurements. Add an organization/company ID and ownership fields where records need to be isolated.
4. Create a `profiles` table keyed to `auth.users.id` for role and account status, and store page grants (for example a `text[]` column) there. Keep user administration behind a trusted admin policy.
5. Enable RLS on every table before exposing it to the browser. Write and test policies so:
   - Signed-in staff can only read records for their organization and granted pages.
   - Only admins can update or delete records.
   - Employees can insert only where their role permits.
   - Users cannot make themselves admins or grant themselves additional pages.
6. Add `@supabase/supabase-js` and replace the app's `localStorage` reads/writes with Supabase queries. Use the public `anon` key in the browser; RLS is what protects the data.
7. Export any records you want to keep from the browser that currently holds them, migrate/import them into Supabase, then verify the record counts and test with separate admin, employee, and read-only accounts.
8. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to Vercel's Development/Preview/Production environment settings, then redeploy.
9. Test the RLS rules directly with a non-admin user before entering live billing or company data.

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
