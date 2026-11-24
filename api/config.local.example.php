<?php
// Copy this file to config.local.php on the DEPLOYED PHP host.
// Never commit the copied file or put SUPABASE_SERVICE_KEY in the app.
define('SUPABASE_URL', 'https://YOUR_PROJECT_REF.supabase.co');
define('SUPABASE_SERVICE_KEY', 'YOUR_SUPABASE_SERVICE_ROLE_KEY');

// Replace these deployment values as needed. API_KEY is the value sent by the
// installed app in X-API-KEY. GOOGLE_CLIENT_ID must match app/app.js.
define('API_KEY', 'replace-with-a-long-random-api-key');
define('GOOGLE_CLIENT_ID', 'your-google-web-client-id.apps.googleusercontent.com');
