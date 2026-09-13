# Team Ojas Racing Inventory — V8 Authentication

## 1. Install and run
```bash
npm install
npm run dev
```
Open http://localhost:3000

## 2. Supabase authentication setup
In Supabase SQL Editor, run `SUPABASE_AUTH_SETUP.sql` after your existing inventory/RLS setup.

This creates:
- `profiles` table
- Admin / Team Member / Viewer roles
- automatic profile creation after signup
- secure RLS for categories and parts
- authenticated storage upload/read policies

## 3. Create the first account
Use **JOIN THE TEAM** on the website. Create your account and confirm your email if Supabase requires it.

Then in Supabase SQL Editor, replace the email in the example at the bottom of `SUPABASE_AUTH_SETUP.sql` and run it once to make your account `Admin`.

## 4. Team members
After the first Admin account is working, team accounts can be created through Supabase Auth/invitations. New accounts default to `Team Member`; Admins can change roles from the Team page.

## 5. Roles
- Admin: full inventory + category access and role management
- Team Member: add/edit/delete inventory and categories
- Viewer: read-only inventory access

The publishable key in `.env.local` is intended for browser use. Never put a Supabase secret/service-role key in this project.
