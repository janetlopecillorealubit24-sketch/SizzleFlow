<?php
// Local/deployment secrets belong in config.local.php, which is ignored by Git.
if (is_file(__DIR__ . '/config.local.php')) require_once __DIR__ . '/config.local.php';

// config.local.php is used by XAMPP/InfinityFree. Render supplies the same
// values as environment variables, so credentials never need to enter Git.
function config_env(string $name, string $fallback = ''): string {
    $value = getenv($name);
    return $value === false || $value === '' ? $fallback : $value;
}

// Defaults keep the XAMPP development setup working.
defined('DB_HOST') || define('DB_HOST', config_env('DB_HOST', 'localhost'));
defined('DB_NAME') || define('DB_NAME', config_env('DB_NAME', 'sizzleflow'));
defined('DB_USER') || define('DB_USER', config_env('DB_USER', 'root'));
defined('DB_PASS') || define('DB_PASS', config_env('DB_PASS'));
defined('API_KEY') || define('API_KEY', config_env('API_KEY', 'change-this-secret-key'));
defined('GOOGLE_CLIENT_ID') || define('GOOGLE_CLIENT_ID', config_env('GOOGLE_CLIENT_ID', '531466811982-a9llaigspe91paod25s9em9oi9uuk9e4.apps.googleusercontent.com'));

if (!defined('SUPABASE_URL') && config_env('SUPABASE_URL') !== '') define('SUPABASE_URL', config_env('SUPABASE_URL'));
if (!defined('SUPABASE_SERVICE_KEY') && config_env('SUPABASE_SERVICE_KEY') !== '') define('SUPABASE_SERVICE_KEY', config_env('SUPABASE_SERVICE_KEY'));
