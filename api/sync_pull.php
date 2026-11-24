<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/supabase.php';
require_key();

try {
    supabase_ensure_catalog();

    $users = supabase_query('users', ['select'=>'id,full_name,username,password_hash,role,is_active,email,google_sub,auth_provider', 'order'=>'id.asc']);
    $namesByUserId = [];
    foreach ($users as $user) $namesByUserId[(string)$user['id']] = (string)$user['full_name'];

    $itemsBySaleId = [];
    foreach (supabase_query('sale_items', ['select'=>'id,sale_id,product_id,item_name,category_id,options_json,quantity,unit_price,subtotal', 'order'=>'id.asc']) as $item) {
        $saleId = (string)$item['sale_id'];
        $itemsBySaleId[$saleId][] = [
            'id'=>$item['id'], 'sale_id'=>$item['sale_id'], 'product_id'=>(int)$item['product_id'],
            'name'=>$item['item_name'] ?? '', 'category_id'=>$item['category_id'] === null ? null : (int)$item['category_id'],
            'options'=>$item['options_json'] ?? null, 'quantity'=>(int)$item['quantity'],
            'unit_price'=>$item['unit_price'], 'subtotal'=>$item['subtotal']
        ];
    }

    $sales = array_map(static function(array $sale) use ($itemsBySaleId, $namesByUserId): array {
        $sale['cashier'] = $namesByUserId[(string)$sale['user_id']] ?? '';
        $sale['items'] = $itemsBySaleId[(string)$sale['id']] ?? [];
        $sale['sync_status'] = 'synced';
        $sale['is_deleted'] = !empty($sale['is_deleted']) ? 1 : 0;
        return $sale;
    }, supabase_query('sales', ['select'=>'id,receipt_no,user_id,customer_name,device_id,payment_method,total_amount,sale_date,is_deleted,updated_at', 'order'=>'sale_date.desc']));

    $expenses = array_map(static function(array $expense): array {
        $expense['sync_status'] = 'synced';
        $expense['is_deleted'] = !empty($expense['is_deleted']) ? 1 : 0;
        return $expense;
    }, supabase_query('expenses', ['select'=>'id,user_id,category_id,description,amount,expense_date,is_deleted,updated_by,updated_at', 'order'=>'expense_date.desc']));

    json_out([
        'users' => $users,
        'product_categories' => supabase_query('product_categories', ['select'=>'id,name', 'order'=>'id.asc']),
        'products' => supabase_query('products', ['select'=>'id,category_id,name,price,options_json,is_active', 'order'=>'id.asc']),
        'expense_categories' => supabase_query('expense_categories', ['select'=>'id,name', 'order'=>'id.asc']),
        'sales' => $sales,
        'expenses' => $expenses,
    ]);
} catch (Throwable $ex) {
    json_out(['error' => $ex->getMessage()], 500);
}
