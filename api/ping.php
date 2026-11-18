<?php
// Quick check used by "Test server" in the app.
require_once __DIR__ . '/db.php';
require_key();
json_out(['ok' => true, 'time' => date('Y-m-d H:i:s')]);
