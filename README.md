# RSVP

A shared RSVP board for recurring events. Admins can add events; visitors can RSVP Yes/Maybe/No. Data is stored in a local SQLite file on my Raspberry Pi, so it persists as long as the Pi stays online.

## How to run (Raspberry Pi)
1. Install dependencies: pip install -r requirements.txt
2. Start the server: python app.py
3. Open the site at http://<pi-ip-address>:5000

## How to use
- Click **Admin mode** to add or edit events.
- Share the site link with your group so they can RSVP.

## Admin credentials
The admin username/password are currently hardcoded in app.py. Update these values before sharing:
- ADMIN_USERNAME
- ADMIN_PASSWORD

## Notes
- Admin mode uses a login token stored in the browser.
- The database file is events.db in this folder.
