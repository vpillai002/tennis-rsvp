# Tennis RSVP

A shared RSVP board for recurring tennis events. Admins can add events; visitors can RSVP Yes/Maybe/No. Data is stored in a shared SQLite database on the server.

## How to run
1. Install dependencies: pip install -r requirements.txt
2. Start the server: python app.py
3. Open the site at http://localhost:5000

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

## Notes
- Admin mode uses a login token stored in the browser.
