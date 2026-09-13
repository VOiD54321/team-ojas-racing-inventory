# Team Ojas Racing Inventory V11

V11 adds a proper mobile navigation bar.

On screens <= 600px:
- The desktop sidebar is replaced by a fixed bottom navigation bar.
- Dashboard, Inventory, Categories, Maintenance, and Team are all directly accessible.
- Safe-area padding is included for phones with gesture/navigation areas.
- Main content receives bottom padding so the navigation does not cover content.
- Desktop layout remains unchanged.
- V9 mobile Supabase authentication fix and V10 local-network configuration are preserved.

Run:
```bash
npm install
npm run dev -- -H 0.0.0.0
```
