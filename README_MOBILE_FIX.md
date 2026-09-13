# Team Ojas Racing Inventory V9

V9 keeps the V8 Supabase/Auth setup and fixes a mobile-browser loading issue.

Changes:
- Auth initialization has an 8-second safety timeout.
- Supabase profile loading is no longer awaited inside `onAuthStateChange`.
- Authentication errors are surfaced instead of leaving the app on "LOADING INVENTORY".
- The existing Supabase URL/key, database schema, logo, roles, and inventory UI are preserved.

Run:
```bash
npm install
npm run dev -- -H 0.0.0.0
```

For a phone on the same Wi-Fi, open the Network URL shown by Next.js, e.g.
`http://192.168.x.x:3000`.
