# Tennis RSVP

A shared RSVP board for recurring tennis events. Admins can add events; visitors can RSVP Yes/Maybe/No. Data is stored in Supabase (Postgres), so it persists even when Render sleeps.

## Supabase setup (free)
1. Create a free Supabase project.
2. In Supabase, open **Project Settings → Database** and copy the connection string.
3. Set an environment variable named SUPABASE_DB_URL to that connection string.

## How to run (local)
1. Install dependencies: pip install -r requirements.txt
2. Set SUPABASE_DB_URL in your terminal.
3. Start the server: python app.py
4. Open the site at http://localhost:5000

## How to use
- Click **Admin mode** to add or edit events.
- Share the site link with your group so they can RSVP.

## Admin credentials
The admin username/password are currently hardcoded in app.py. Update these values before sharing:
- ADMIN_USERNAME
- ADMIN_PASSWORD

## Render (free) deployment
1. Push this folder to a GitHub repo.
2. Create a new Render Web Service from the repo.
3. Render will read render.yaml and use gunicorn.
4. In Render → Environment, add SUPABASE_DB_URL.

## Notes
- Admin mode uses a login token stored in the browser.
