# Team Ojas Racing Inventory — Supabase version

This version uses Supabase for shared categories and inventory data.

## Setup
1. Run `npm install`.
2. Run `npm run dev`.
3. In Supabase SQL Editor, run `SUPABASE_SETUP.sql` to create the part-images bucket and temporary browser-access policies.
4. Open `http://localhost:3000`.

The browser uses the Supabase publishable key from `.env.local`. Do not replace it with a secret/service-role key.

### Important
The SQL policies are intentionally open for the prototype so the team can use the app before login is implemented. The next security step is Supabase Auth + Row Level Security with Admin / Team Member / Viewer roles.
