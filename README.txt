SIZZLEFLOW - DEVELOPMENT AND DEPLOYMENT
=======================================

The app is offline-first, but its shared users, catalog and sync data use the
Supabase database through the PHP API bridge in api/. The Supabase service key
must stay on that server and must never be placed in the Android app.

LOCAL DEVELOPMENT
1. Put this folder inside C:\xampp\htdocs\.
2. Start Apache in XAMPP.
3. Open http://localhost/SizzleFlow/app/.
   The browser build automatically uses the local api/ folder.

CLOUD DEPLOYMENT
1. Create/configure the Supabase project and run supabase/schema.sql in the
   Supabase SQL Editor.
2. Deploy the api/ folder to a public HTTPS PHP host (for example
   https://api.example.com/SizzleFlow/api). Apache on a developer laptop is
   not a production backend.
3. On that host, create api/config.local.php from api/config.local.example.php
   and fill in the Supabase URL, service-role key, Google client ID and a long
   random API key.
4. Set the deployed API URL in app/runtime-config.js and www/runtime-config.js:
   window.SIZZLEFLOW_API_URL = 'https://api.example.com/SizzleFlow/api';
5. Run `npx cap sync android` and build the Android app. Every installed device
   will use the cloud API over the internet; it will not use 192.168.x.x.

The Settings > Server fields are retained for testing or an administrator's
temporary override. Do not distribute the service-role key in the app.

FOLDERS
  app\       installed app screens and runtime configuration
  api\       PHP API bridge; it writes to Supabase
  supabase\  Supabase schema and seed data

TEST THE LOCAL BACKEND:  http://localhost/SizzleFlow/api/ping.php
  Seeing {"error":"Unauthorized"} means it works.

EDIT + PREVIEW: save a file (Ctrl+S) then press Ctrl+Shift+R in Chrome.
In the app, Settings > Test server, then Sync now.
