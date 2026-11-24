<?php
// Local/deployment secrets belong in config.local.php, which is ignored by Git.
if (is_file(__DIR__ . '/config.local.php')) require_once __DIR__ . '/config.local.php';

// Defaults keep the XAMPP development setup working. Production values should
// be defined in config.local.php on the deployed PHP host.
defined('DB_HOST') || define('DB_HOST', 'localhost');
defined('DB_NAME') || define('DB_NAME', 'sizzleflow');
defined('DB_USER') || define('DB_USER', 'root');
defined('DB_PASS') || define('DB_PASS', '');
defined('API_KEY') || define('API_KEY', 'change-this-secret-key');
defined('GOOGLE_CLIENT_ID') || define('GOOGLE_CLIENT_ID', '531466811982-a9llaigspe91paod25s9em9oi9uuk9e4.apps.googleusercontent.com');
