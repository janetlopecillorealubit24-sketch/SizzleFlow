<?php
require_once __DIR__ . '/db.php';
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

$pdo = pdo();
$googleSub = (string)$claims['sub'];
$email = strtolower(trim((string)($claims['email'] ?? '')));
$name = trim((string)($claims['name'] ?? $email));
$stmt = $pdo->prepare('SELECT id, full_name, username, password_hash, role, is_active, email, google_sub, auth_provider FROM users WHERE google_sub = :sub OR (email = :email AND email <> \'\') LIMIT 1');
$stmt->execute([':sub' => $googleSub, ':email' => $email]);
$user = $stmt->fetch();

if (!$user) {
    $base = preg_replace('/[^a-z0-9_-]/', '', strtolower((string)strstr($email, '@', true))) ?: 'user';
    $base = substr($base, 0, 42);
    $username = $base;
    $n = 1;
    while (true) {
        $check = $pdo->prepare('SELECT 1 FROM users WHERE username = :username LIMIT 1');
        $check->execute([':username' => $username]);
        if (!$check->fetchColumn()) break;
        $username = substr($base, 0, 42) . $n++;
    }
    $id = sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x', random_int(0,65535), random_int(0,65535), random_int(0,65535), random_int(16384,20479), random_int(32768,49151), random_int(0,65535), random_int(0,65535), random_int(0,65535));
    $insert = $pdo->prepare("INSERT INTO users (id, full_name, username, password_hash, role, is_active, email, google_sub, auth_provider) VALUES (:id, :name, :username, :password_hash, 'staff', 1, :email, :sub, 'google')");
    $insert->execute([':id'=>$id, ':name'=>$name ?: $username, ':username'=>$username, ':password_hash'=>bin2hex(random_bytes(32)), ':email'=>$email, ':sub'=>$googleSub]);
    $stmt = $pdo->prepare('SELECT id, full_name, username, password_hash, role, is_active, email, google_sub, auth_provider FROM users WHERE id = :id');
    $stmt->execute([':id'=>$id]);
    $user = $stmt->fetch();
} else {
    $update = $pdo->prepare("UPDATE users SET google_sub = :sub, email = :email, auth_provider = 'google', full_name = :name WHERE id = :id");
    $update->execute([':sub'=>$googleSub, ':email'=>$email, ':name'=>$name ?: $user['full_name'], ':id'=>$user['id']]);
    $user['google_sub'] = $googleSub; $user['email'] = $email; $user['auth_provider'] = 'google'; $user['full_name'] = $name ?: $user['full_name'];
}

json_out(['user' => $user]);
