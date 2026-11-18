<?php
// Receives sales and expenses saved offline on a phone.
// Every record has a UUID, so sending the same record again only updates it:
// the server never creates duplicates.
require_once __DIR__ . '/db.php';
require_key();

$data = json_decode(file_get_contents('php://input'), true);
if (!is_array($data)) {
    json_out(['error' => 'Invalid JSON'], 400);
}

$sales    = $data['sales'] ?? [];
$expenses = $data['expenses'] ?? [];

$pdo = pdo();
$syncedSales = [];
$syncedExpenses = [];

try {
    $pdo->beginTransaction();

    $saleStmt = $pdo->prepare(
        "INSERT INTO sales (id, receipt_no, user_id, customer_name, device_id, payment_method, total_amount,
                            sale_date, sync_status, is_deleted, updated_at)
         VALUES (:id, :receipt_no, :user_id, :customer_name, :device_id, :payment_method, :total_amount,
                 :sale_date, 'synced', :is_deleted, :updated_at)
         ON DUPLICATE KEY UPDATE
            customer_name  = VALUES(customer_name),
            payment_method = VALUES(payment_method),
            total_amount   = VALUES(total_amount),
            is_deleted     = VALUES(is_deleted),
            updated_at     = VALUES(updated_at),
            sync_status    = 'synced'"
    );

    $itemStmt = $pdo->prepare(
        "INSERT INTO sale_items (id, sale_id, product_id, item_name, category_id, options_json, quantity, unit_price, subtotal)
         VALUES (:id, :sale_id, :product_id, :item_name, :category_id, :options_json, :quantity, :unit_price, :subtotal)
         ON DUPLICATE KEY UPDATE
            item_name  = VALUES(item_name),
            category_id = VALUES(category_id),
            options_json = VALUES(options_json),
            quantity   = VALUES(quantity),
            unit_price = VALUES(unit_price),
            subtotal   = VALUES(subtotal)"
    );

    foreach ($sales as $s) {
        $saleStmt->execute([
            ':id'             => $s['id'],
            ':receipt_no'     => $s['receipt_no'],
            ':user_id'        => $s['user_id'],
            ':customer_name'  => $s['customer_name'] ?? null,
            ':device_id'      => $s['device_id'],
            ':payment_method' => $s['payment_method'],
            ':total_amount'   => $s['total_amount'],
            ':sale_date'      => $s['sale_date'],
            ':is_deleted'     => (int)($s['is_deleted'] ?? 0),
            ':updated_at'     => $s['updated_at'] ?? $s['sale_date'],
        ]);
        foreach (($s['items'] ?? []) as $i) {
            $itemStmt->execute([
                ':id'         => $i['id'],
                ':sale_id'    => $i['sale_id'],
                ':product_id' => (int)$i['product_id'],
                ':item_name'  => $i['name'] ?? null,
                ':category_id'=> isset($i['category_id']) ? (int)$i['category_id'] : null,
                ':options_json' => json_encode($i['options'] ?? null),
                ':quantity'   => (int)$i['quantity'],
                ':unit_price' => $i['unit_price'],
                ':subtotal'   => $i['subtotal'],
            ]);
        }
        $syncedSales[] = $s['id'];
    }

    $expStmt = $pdo->prepare(
        "INSERT INTO expenses (id, user_id, category_id, description, amount, expense_date,
                               sync_status, is_deleted, updated_by, updated_at)
         VALUES (:id, :user_id, :category_id, :description, :amount, :expense_date,
                 'synced', :is_deleted, :updated_by, :updated_at)
         ON DUPLICATE KEY UPDATE
            category_id  = VALUES(category_id),
            description  = VALUES(description),
            amount       = VALUES(amount),
            expense_date = VALUES(expense_date),
            is_deleted   = VALUES(is_deleted),
            updated_by   = VALUES(updated_by),
            updated_at   = VALUES(updated_at),
            sync_status  = 'synced'"
    );

    foreach ($expenses as $e) {
        $expStmt->execute([
            ':id'           => $e['id'],
            ':user_id'      => $e['user_id'],
            ':category_id'  => (int)$e['category_id'],
            ':description'  => $e['description'],
            ':amount'       => $e['amount'],
            ':expense_date' => $e['expense_date'],
            ':is_deleted'   => (int)($e['is_deleted'] ?? 0),
            ':updated_by'   => $e['updated_by'] ?? $e['user_id'],
            ':updated_at'   => $e['updated_at'] ?? null,
        ]);
        $syncedExpenses[] = $e['id'];
    }

    $pdo->commit();
    json_out(['synced_sales' => $syncedSales, 'synced_expenses' => $syncedExpenses]);
} catch (Throwable $ex) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    json_out(['error' => $ex->getMessage()], 500);
}
