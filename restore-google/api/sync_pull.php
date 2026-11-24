<?php
// Sends the menu, categories, and staff accounts to the app.
require_once __DIR__ . '/db.php';
require_key();

try {
    $pdo = pdo();
    json_out([
        'users' => $pdo->query(
            "SELECT id, full_name, username, password_hash, role, is_active, email, google_sub, auth_provider FROM users"
        )->fetchAll(),
        'product_categories' => $pdo->query(
            "SELECT id, name FROM product_categories ORDER BY id"
        )->fetchAll(),
        'products' => $pdo->query(
            "SELECT id, category_id, name, price, options_json, is_active FROM products ORDER BY id"
        )->fetchAll(),
        'expense_categories' => $pdo->query(
            "SELECT id, name FROM expense_categories ORDER BY id"
        )->fetchAll(),
    ]);
} catch (Throwable $ex) {
    json_out(['error' => $ex->getMessage()], 500);
}
