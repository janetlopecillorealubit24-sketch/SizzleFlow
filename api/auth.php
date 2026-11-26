<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/supabase.php';

function auth_select(): string {
    return 'id,full_name,username,role,is_active,email,google_sub,auth_provider,email_verified,created_at';
}

function public_user(array $user): array {
    unset($user['password_hash']);
    return $user;
}

function uuid_v4(): string {
    $bytes = random_bytes(16);
    $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
    $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($bytes), 4));
}

function auth_cookie_options(): array {
    $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    return ['expires'=>time()+60*60*24*30, 'path'=>'/', 'secure'=>$secure, 'httponly'=>true, 'samesite'=>$secure ? 'None' : 'Lax'];
}

function set_auth_cookie(string $token): void { setcookie(AUTH_COOKIE_NAME, $token, auth_cookie_options()); }
function clear_auth_cookie(): void { setcookie(AUTH_COOKIE_NAME, '', array_merge(auth_cookie_options(), ['expires'=>time()-3600])); }

function create_session(array $user): void {
    $token = bin2hex(random_bytes(32));
    supabase_upsert('auth_sessions', [[
        'id'=>uuid_v4(), 'user_id'=>$user['id'], 'token_hash'=>hash('sha256', $token),
        'expires_at'=>gmdate('c', time()+60*60*24*30)
    ]]);
    set_auth_cookie($token);
}

function session_user(): ?array {
    $token = $_COOKIE[AUTH_COOKIE_NAME] ?? '';
    if ($token === '') return null;
    $sessions = supabase_query('auth_sessions', ['token_hash'=>'eq.'.hash('sha256', $token), 'expires_at'=>'gt.'.gmdate('c'), 'select'=>'user_id', 'limit'=>'1']);
    if (!$sessions) return null;
    $users = supabase_query('users', ['id'=>'eq.'.$sessions[0]['user_id'], 'select'=>auth_select(), 'limit'=>'1']);
    return $users[0] ?? null;
}

function require_session(): array {
    $user = session_user();
    if (!$user || empty($user['is_active'])) json_out(['error'=>'Your session has expired. Please log in again.'], 401);
    return $user;
}

function gmail_access_token(): string {
    if (GOOGLE_CLIENT_SECRET === '' || GMAIL_REFRESH_TOKEN === '') throw new RuntimeException('Gmail API is not configured on the server.');
    $body = http_build_query(['client_id'=>GOOGLE_CLIENT_ID, 'client_secret'=>GOOGLE_CLIENT_SECRET, 'refresh_token'=>GMAIL_REFRESH_TOKEN, 'grant_type'=>'refresh_token']);
    $context = stream_context_create(['http'=>['method'=>'POST','header'=>"Content-Type: application/x-www-form-urlencoded\r\n",'content'=>$body,'timeout'=>15,'ignore_errors'=>true]]);
    $raw = @file_get_contents('https://oauth2.googleapis.com/token', false, $context);
    $data = json_decode($raw ?: '', true);
    if (!is_array($data) || empty($data['access_token'])) throw new RuntimeException('Gmail API access token could not be created.');
    return $data['access_token'];
}

function gmail_send_otp(string $email, string $otp): void {
    if (GMAIL_SENDER === '') throw new RuntimeException('GMAIL_SENDER is not configured on the server.');
    $subject = 'Your SizzleFlow verification code';
    $message = "Your SizzleFlow verification code is {$otp}.\r\n\r\nIt expires in 10 minutes. You have up to 5 attempts.";
    $mime = "From: SizzleFlow <" . GMAIL_SENDER . ">\r\nTo: {$email}\r\nSubject: {$subject}\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n{$message}";
    $encoded = rtrim(strtr(base64_encode($mime), '+/', '-_'), '=');
    $token = gmail_access_token();
    $context = stream_context_create(['http'=>['method'=>'POST','header'=>"Authorization: Bearer {$token}\r\nContent-Type: application/json\r\n",'content'=>json_encode(['raw'=>$encoded]),'timeout'=>20,'ignore_errors'=>true]]);
    $raw = @file_get_contents('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', false, $context);
    $status = 0; foreach (($http_response_header ?? []) as $header) if (preg_match('/^HTTP\/\S+\s+(\d+)/', $header, $m)) {$status=(int)$m[1]; break;}
    if ($status < 200 || $status >= 300) throw new RuntimeException('The verification email could not be sent.');
}
