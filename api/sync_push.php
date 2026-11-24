<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/supabase.php';
require_key();

$data = json_decode(file_get_contents('php://input'), true);
if (!is_array($data)) json_out(['error' => 'Invalid JSON'], 400);

$sales = $data['sales'] ?? [];
$expenses = $data['expenses'] ?? [];
$clientUser = $data['user'] ?? null;
$categories = $data['categories'] ?? [];
$products = $data['products'] ?? [];

try {
    // Resolve the cloud user first. A local account can have an id that is
    // different from an account previously created by Google/email, so sales
    // must use the actual Supabase users.id value.
    if (!is_array($clientUser) || empty($clientUser['id'])) {
        json_out(['error' => 'Sync requires a signed-in user.'], 400);
    }
    $userId = sync_user($clientUser);

    // Upload catalog rows before sale_items because sale_items.product_id and
    // products.category_id are foreign keys in Supabase.
    $categoryRows = array_map(static fn(array $c): array => [
        'id'=>(int)$c['id'], 'name'=>(string)$c['name']
    ], array_filter($categories, 'is_array'));
    if ($categoryRows) supabase_upsert('product_categories', $categoryRows);
    $productRows = array_map(static fn(array $p): array => [
        'id'=>(int)$p['id'], 'category_id'=>(int)$p['category_id'], 'name'=>(string)$p['name'],
        'price'=>$p['price'], 'options_json'=>$p['options_json'] ?? ($p['options'] ?? null),
        'is_active'=>(bool)($p['is_active'] ?? true)
    ], array_filter($products, 'is_array'));
    if ($productRows) supabase_upsert('products', $productRows);

    $saleRows = [];
    $itemRows = [];
    foreach ($sales as $s) {
        $saleRows[] = [
            'id'=>$s['id'], 'receipt_no'=>$s['receipt_no'], 'user_id'=>$userId,
            'customer_name'=>$s['customer_name'] ?? null, 'device_id'=>$s['device_id'],
            'payment_method'=>$s['payment_method'], 'total_amount'=>$s['total_amount'],
            'sale_date'=>$s['sale_date'],
            'is_deleted'=>(int)($s['is_deleted'] ?? 0), 'updated_at'=>$s['updated_at'] ?? ($s['sale_date'] ?? null)
        ];
        foreach (($s['items'] ?? []) as $i) {
            $itemRows[] = [
                'id'=>$i['id'], 'sale_id'=>$i['sale_id'], 'product_id'=>(int)$i['product_id'],
                'item_name'=>$i['name'] ?? null, 'category_id'=>isset($i['category_id']) ? (int)$i['category_id'] : null,
                'options_json'=>$i['options'] ?? null, 'quantity'=>(int)$i['quantity'],
                'unit_price'=>$i['unit_price'], 'subtotal'=>$i['subtotal']
            ];
        }
    }
    $expenseRows = array_map(static function(array $e) use ($userId): array {
        return [
            'id'=>$e['id'], 'user_id'=>$userId, 'category_id'=>(int)$e['category_id'],
            'description'=>$e['description'], 'amount'=>$e['amount'], 'expense_date'=>$e['expense_date'],
            'is_deleted'=>(int)($e['is_deleted'] ?? 0),
            'updated_by'=>$userId, 'updated_at'=>$e['updated_at'] ?? null
        ];
    }, $expenses);

    supabase_upsert('sales', $saleRows);
    supabase_upsert('sale_items', $itemRows);
    supabase_upsert('expenses', $expenseRows);
    json_out(['synced_sales'=>array_column($saleRows, 'id'), 'synced_expenses'=>array_column($expenseRows, 'id')]);
} catch (Throwable $ex) {
    json_out(['error' => $ex->getMessage()], 500);
}

function sync_user(array $clientUser): string {
    $id = (string)$clientUser['id'];
    $select = 'id,full_name,username,password_hash,role,is_active,email,google_sub,auth_provider';
    $isUuid = preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i', $id);
    $rows = $isUuid ? supabase_query('users', ['id'=>'eq.' . $id, 'select'=>$select, 'limit'=>'1']) : [];
    if (!$rows && !empty($clientUser['google_sub'])) {
        $rows = supabase_query('users', ['google_sub'=>'eq.' . $clientUser['google_sub'], 'select'=>$select, 'limit'=>'1']);
    }
    if (!$rows && !empty($clientUser['email'])) {
        $rows = supabase_query('users', ['email'=>'eq.' . strtolower(trim((string)$clientUser['email'])), 'select'=>$select, 'limit'=>'1']);
    }
    if (!$rows && !empty($clientUser['username'])) {
        $rows = supabase_query('users', ['username'=>'eq.' . $clientUser['username'], 'select'=>$select, 'limit'=>'1']);
    }
    if ($rows) return (string)$rows[0]['id'];

    if (!preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i', $id)) {
        $id = sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x', random_int(0,65535), random_int(0,65535), random_int(0,65535), random_int(16384,20479), random_int(32768,49151), random_int(0,65535), random_int(0,65535), random_int(0,65535));
    }
    $username = (string)($clientUser['username'] ?? ('user_' . substr($id, 0, 8)));
    $base = substr($username, 0, 42) ?: 'user'; $candidate = $base; $n = 1;
    while (supabase_query('users', ['username'=>'eq.' . $candidate, 'select'=>'id', 'limit'=>'1'])) $candidate = substr($base, 0, 42) . $n++;
    supabase_upsert('users', [[
        'id'=>$id, 'full_name'=>$clientUser['full_name'] ?? $candidate, 'username'=>$candidate,
        'password_hash'=>$clientUser['password_hash'] ?? '', 'email'=>$clientUser['email'] ?? null,
        'google_sub'=>$clientUser['google_sub'] ?? null, 'auth_provider'=>$clientUser['auth_provider'] ?? 'password',
        'role'=>$clientUser['role'] ?? 'staff', 'is_active'=>(bool)($clientUser['is_active'] ?? true)
    ]]);
    return $id;
}
