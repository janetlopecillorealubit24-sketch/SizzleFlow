<?php
require_once __DIR__ . '/config.php';

function supabase_request(string $table, string $method = 'GET', string $query = '', ?array $body = null, string $prefer = 'return=representation'): array {
    if (!defined('SUPABASE_URL') || !defined('SUPABASE_SERVICE_KEY')) {
        json_out(['error' => 'Supabase is not configured on the server.'], 503);
    }
    $url = rtrim(SUPABASE_URL, '/') . '/rest/v1/' . rawurlencode($table) . ($query !== '' ? '?' . $query : '');
    $headers = "apikey: " . SUPABASE_SERVICE_KEY . "\r\n"
        . "Authorization: Bearer " . SUPABASE_SERVICE_KEY . "\r\n"
        . "Content-Type: application/json\r\n"
        . "Accept: application/json\r\n"
        . "Prefer: " . $prefer . "\r\n";
    $context = stream_context_create(['http' => [
        'method' => strtoupper($method),
        'header' => $headers,
        'content' => $body === null ? '' : json_encode($body),
        'timeout' => 20,
        'ignore_errors' => true,
    ]]);
    $raw = @file_get_contents($url, false, $context);
    $status = 0;
    foreach (($http_response_header ?? []) as $header) {
        if (preg_match('/^HTTP\/\S+\s+(\d+)/', $header, $match)) { $status = (int)$match[1]; break; }
    }
    if ($raw === false) json_out(['error' => 'Supabase connection failed.'], 502);
    $data = json_decode($raw, true);
    if ($status < 200 || $status >= 300) {
        $message = is_array($data) ? (string)($data['message'] ?? $data['hint'] ?? $data['details'] ?? $data['error'] ?? '') : '';
        json_out(['error' => 'Supabase error (' . $status . '): ' . ($message ?: substr($raw, 0, 300))], 502);
    }
    return is_array($data) ? $data : [];
}

function supabase_query(string $table, array $params): array {
    $parts = [];
    foreach ($params as $key => $value) $parts[] = rawurlencode($key) . '=' . rawurlencode($value);
    return supabase_request($table, 'GET', implode('&', $parts));
}

function supabase_upsert(string $table, array $rows): array {
    if (!$rows) return [];
    return supabase_request($table, 'POST', '', $rows, 'resolution=merge-duplicates,return=representation');
}

function supabase_ensure_catalog(): void {
    supabase_upsert('product_categories', [
        ['id'=>1,'name'=>'Meals'],['id'=>2,'name'=>'Silog Meals'],['id'=>3,'name'=>'Snacks'],['id'=>4,'name'=>'Fries'],
        ['id'=>5,'name'=>'Fruit Soda Series'],['id'=>6,'name'=>'Yakult Series'],['id'=>7,'name'=>'Special Drinks'],['id'=>8,'name'=>'Snack Combos']
    ]);
    $products = [
        [1,1,'Chicken Pastil',55,null],[2,1,'Pork Tonkatsu',69,null],[3,1,'Fried Chicken',55,null],[4,1,'Pork Sisig (Regular)',59,null],[5,1,'Pork Sisig with Egg',69,null],
        [6,2,'Hotsilog',39,null],[7,2,'Lumpiasilog',39,null],[8,2,'Siomaisilog',39,null],[9,2,'Hamsilog',39,null],[10,2,'Porksilog',59,null],[11,2,'Tapsilog',69,null],
        [12,3,'Regular Burger',20,null],[13,3,'Cheese Burger',25,null],[14,3,'Burger With Egg',35,null],[15,3,'Hotdog Sandwich',25,null],[16,3,'Cheesy Hotdog Sandwich',35,null],
        [17,4,'Fries',30,['type'=>'fries','flavors'=>['Cheese','Sour Cream','Barbecue']]],
        [18,5,'Fruit Soda',29,['type'=>'flavorSize','flavors'=>['Strawberry','Lychee','Green Apple','Lemon','Blueberry'],'sizes'=>[['name'=>'12oz','price'=>29],['name'=>'16oz','price'=>39]]]],
        [19,6,'Yakult Series',44,['type'=>'flavorSize','flavors'=>['Strawberry','Lychee','Green Apple','Lemon','Blueberry'],'sizes'=>[['name'=>'12oz','price'=>44],['name'=>'16oz','price'=>54]]]],
        [20,7,'Iced Coffee Latte',49,['type'=>'size','sizes'=>[['name'=>'12oz','price'=>49],['name'=>'16oz','price'=>59]]]],
        [21,7,'Matcha Latte',49,['type'=>'size','sizes'=>[['name'=>'12oz','price'=>49],['name'=>'16oz','price'=>59]]]],
        [22,7,'Lemonade',39,['type'=>'size','sizes'=>[['name'=>'12oz','price'=>39],['name'=>'16oz','price'=>49]]]],
        [23,7,'Oreo Matcha Latte',59,['type'=>'size','sizes'=>[['name'=>'12oz','price'=>59],['name'=>'16oz','price'=>69]]]],
        [24,8,'Combo A',45,['type'=>'combo','requires'=>['sodaFlavor'],'included'=>'Regular Burger + Fruit Soda','price'=>45]],
        [25,8,'Combo B',50,['type'=>'combo','requires'=>['sodaFlavor'],'included'=>'Hotdog Sandwich + Fruit Soda','price'=>50]],
        [26,8,'Combo C',55,['type'=>'combo','requires'=>['friesFlavor','sodaFlavor'],'included'=>'Fries + Fruit Soda','price'=>55]],
        [27,8,'Combo D',45,['type'=>'combo','requires'=>['friesFlavor'],'included'=>'Regular Burger + Fries','price'=>45]],
        [28,8,'Combo E',50,['type'=>'combo','requires'=>['friesFlavor'],'included'=>'Hotdog Sandwich + Fries','price'=>50]],
    ];
    $rows = array_map(static fn($p) => ['id'=>$p[0],'category_id'=>$p[1],'name'=>$p[2],'price'=>$p[3],'options_json'=>$p[4],'is_active'=>true], $products);
    supabase_upsert('products', $rows);
    supabase_upsert('expense_categories', [
        ['id'=>1,'name'=>'Ingredients'],['id'=>2,'name'=>'Supplies and Packaging'],['id'=>3,'name'=>'Utilities'],
        ['id'=>4,'name'=>'Transportation'],['id'=>5,'name'=>'Salaries'],['id'=>6,'name'=>'Others']
    ]);
}
