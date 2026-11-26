<?php
// Copy this file to config.local.php on the DEPLOYED PHP host.
// Never commit the copied file or put SUPABASE_SERVICE_KEY in the app.
define('SUPABASE_URL', 'https://YOUR_PROJECT_REF.supabase.co');
define('SUPABASE_SERVICE_KEY', 'YOUR_SUPABASE_SERVICE_ROLE_KEY');

// Replace these deployment values as needed. API_KEY is the value sent by the
// installed app in X-API-KEY. GOOGLE_CLIENT_ID must match app/app.js.
define('API_KEY', 'replace-with-a-long-random-api-key');
define('GOOGLE_CLIENT_ID', 'your-google-web-client-id.apps.googleusercontent.com');

// Gmail API: create an OAuth refresh token for the sender account with the
// gmail.send scope. These values stay on the PHP server and never go in app/.
define('GOOGLE_CLIENT_SECRET', 'your-google-oauth-client-secret');
define('GMAIL_REFRESH_TOKEN', 'your-gmail-oauth-refresh-token');
define('GMAIL_SENDER', 'your-sender@gmail.com');
