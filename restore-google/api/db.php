<?php
require_once __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');

function json_out($data, int $code = 200): void {
    http_response_code($code);
    echo json_encode($data);
    exit;
}

/** Stops the request unless the app sent the correct X-API-KEY header. */
function require_key(): void {
    $key = $_SERVER['HTTP_X_API_KEY'] ?? '';
    if (!hash_equals(API_KEY, $key)) {
        json_out(['error' => 'Unauthorized'], 401);
    }
}

function pdo(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
        // Keep existing XAMPP installations compatible with variation-aware menu records.
        foreach ([
            'ALTER TABLE products ADD COLUMN options_json TEXT NULL',
            'ALTER TABLE sales ADD COLUMN customer_name VARCHAR(255) NULL',
            'ALTER TABLE sale_items ADD COLUMN item_name VARCHAR(255) NULL',
            'ALTER TABLE sale_items ADD COLUMN category_id INT NULL',
            'ALTER TABLE sale_items ADD COLUMN options_json TEXT NULL',
            'ALTER TABLE users ADD COLUMN email VARCHAR(255) NULL',
            'ALTER TABLE users ADD COLUMN google_sub VARCHAR(255) NULL',
            "ALTER TABLE users ADD COLUMN auth_provider VARCHAR(20) NOT NULL DEFAULT 'password'",
            "UPDATE users SET is_active = 0 WHERE username IN ('manager','staff1','staff2','staff3','staff4','staff5','staff6')",
        ] as $migration) {
            try { $pdo->exec($migration); } catch (Throwable $ignored) { /* already applied */ }
        }
    }
    return $pdo;
}
