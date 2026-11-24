<?php
// Quick check used by "Test server" in the app.
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/supabase.php';
require_key();
supabase_query('users', ['select' => 'id', 'limit' => '1']);
json_out(['ok' => true, 'database' => 'supabase', 'time' => date('Y-m-d H:i:s')]);
