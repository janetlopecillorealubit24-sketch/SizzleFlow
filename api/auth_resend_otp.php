<?php
require_once __DIR__ . '/auth.php';
require_key();

$input = request_json();
$email = strtolower(trim((string)($input['email'] ?? '')));
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) json_out(['error'=>'Enter a valid email address.'], 422);

$users = supabase_query('users', ['email'=>'eq.'.$email, 'select'=>'id,email,email_verified', 'limit'=>'1']);
$user = $users[0] ?? null;
if (!$user || !empty($user['email_verified'])) json_out(['error'=>'This account does not need email verification.'], 422);

$latest = supabase_query('auth_otps', ['user_id'=>'eq.'.$user['id'], 'order'=>'created_at.desc', 'select'=>'created_at', 'limit'=>'1']);
$createdAt = !empty($latest[0]['created_at']) ? strtotime($latest[0]['created_at']) : 0;
$wait = 60 - (time() - $createdAt);
if ($wait > 0) json_out(['error'=>'Please wait before requesting another code.', 'retry_after'=>$wait], 429);

$otp = (string)random_int(100000, 999999);
try {
    gmail_send_otp($email, $otp);
    supabase_upsert('auth_otps', [[
        'id'=>uuid_v4(), 'user_id'=>$user['id'], 'email'=>$email,
        'otp_hash'=>password_hash($otp, PASSWORD_DEFAULT), 'attempts'=>0,
        'expires_at'=>gmdate('c', time()+600)
    ]]);
} catch (Throwable $e) {
    json_out(['error'=>$e->getMessage()], 503);
}

json_out(['pending'=>true, 'email'=>$email]);
