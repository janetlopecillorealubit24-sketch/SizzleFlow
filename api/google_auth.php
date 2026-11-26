<?php
require_once __DIR__ . '/auth.php';
require_key();

$input = json_decode(file_get_contents('php://input'), true) ?: [];
$credential = trim((string)($input['credential'] ?? ''));
if ($credential === '') json_out(['error' => 'Missing Google credential.'], 400);

$context = stream_context_create(['http' => ['method' => 'GET', 'timeout' => 10, 'ignore_errors' => true]]);
$raw = @file_get_contents('https://oauth2.googleapis.com/tokeninfo?id_token=' . rawurlencode($credential), false, $context);
$status = 0;
foreach (($http_response_header ?? []) as $header) {
    if (preg_match('/^HTTP\/\S+\s+(\d+)/', $header, $match)) { $status = (int)$match[1]; break; }
}
$claims = json_decode($raw ?: '', true);
if ($status !== 200 || !is_array($claims)
    || ($claims['aud'] ?? '') !== GOOGLE_CLIENT_ID
    || !in_array(($claims['iss'] ?? ''), ['accounts.google.com', 'https://accounts.google.com'], true)
    || (int)($claims['exp'] ?? 0) <= time()
    || ($claims['email_verified'] ?? '') !== 'true') {
    json_out(['error' => 'Google credential could not be verified.'], 401);
}

$googleSub = (string)$claims['sub'];
$email = strtolower(trim((string)($claims['email'] ?? '')));
$name = trim((string)($claims['name'] ?? $email));
$select = auth_select();
$rows = supabase_query('users', ['google_sub' => 'eq.' . $googleSub, 'select' => $select, 'limit' => '1']);
if (!$rows) $rows = supabase_query('users', ['email' => 'eq.' . $email, 'select' => $select, 'limit' => '1']);
$user = $rows[0] ?? null;

if (!$user) {
    $base = preg_replace('/[^a-z0-9_-]/', '', strtolower((string)strstr($email, '@', true))) ?: 'user';
    $base = substr($base, 0, 42);
    $username = $base; $n = 1;
    while (supabase_query('users', ['username' => 'eq.' . $username, 'select' => 'id', 'limit' => '1'])) $username = substr($base, 0, 42) . $n++;
    $id = sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x', random_int(0,65535), random_int(0,65535), random_int(0,65535), random_int(16384,20479), random_int(32768,49151), random_int(0,65535), random_int(0,65535), random_int(0,65535));
    $created = supabase_upsert('users', [[
        'id'=>$id, 'full_name'=>$name ?: $username, 'username'=>$username,
        'password_hash'=>bin2hex(random_bytes(32)), 'role'=>'staff', 'is_active'=>true,
        'email'=>$email, 'google_sub'=>$googleSub, 'auth_provider'=>'google', 'email_verified'=>true
    ]]);
    $user = $created[0] ?? null;
} else {
    supabase_request('users', 'PATCH', 'id=eq.' . rawurlencode($user['id']), [[
        'google_sub'=>$googleSub, 'email'=>$email, 'auth_provider'=>'google', 'full_name'=>$name ?: $user['full_name']
    ]], 'return=minimal');
    $user['google_sub'] = $googleSub; $user['email'] = $email; $user['auth_provider'] = 'google'; $user['full_name'] = $name ?: $user['full_name']; $user['email_verified'] = true;
}

if (!$user) json_out(['error' => 'Could not create or update the Supabase user.'], 502);
create_session($user);
json_out(['user' => public_user($user)]);
