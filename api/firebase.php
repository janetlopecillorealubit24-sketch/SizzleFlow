<?php
require_once __DIR__ . '/db.php';

/** Verify a Firebase ID token through Firebase Identity Toolkit REST API. */
function firebase_identity(): array {
    $token = trim((string)($_SERVER['HTTP_X_FIREBASE_ID_TOKEN'] ?? ''));
    if ($token === '') json_out(['error' => 'Missing Firebase authentication token.'], 401);
    $url = 'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' . rawurlencode(FIREBASE_WEB_API_KEY);
    $context = stream_context_create(['http' => [
        'method' => 'POST', 'timeout' => 15, 'ignore_errors' => true,
        'header' => "Content-Type: application/json\r\n",
        'content' => json_encode(['idToken' => $token]),
    ]]);
    $raw = @file_get_contents($url, false, $context);
    $data = json_decode($raw ?: '', true);
    $user = is_array($data) && isset($data['users'][0]) ? $data['users'][0] : null;
    if (!$user || empty($user['localId']) || empty($user['email'])) {
        json_out(['error' => 'Firebase authentication could not be verified.'], 401);
    }
    $providerIds = array_map(static fn($p) => (string)($p['providerId'] ?? ''), $user['providerUserInfo'] ?? []);
    $isGoogle = in_array('google.com', $providerIds, true);
    if (!$isGoogle && empty($user['emailVerified'])) {
        json_out(['error' => 'Please verify your email address before continuing.'], 403);
    }
    return [
        'uid' => (string)$user['localId'],
        'email' => strtolower(trim((string)$user['email'])),
        'name' => trim((string)($user['displayName'] ?? '')),
        'photo' => (string)($user['photoUrl'] ?? ''),
        'google' => $isGoogle,
        'email_verified' => !empty($user['emailVerified']) || $isGoogle,
    ];
}

function firebase_user_row(array $identity): array {
    $pdo = pdo();
    $stmt = $pdo->prepare('SELECT id, full_name, username, password_hash, role, is_active, email, google_sub, auth_provider FROM users WHERE id = :uid OR email = :email LIMIT 1');
    $stmt->execute([':uid' => $identity['uid'], ':email' => $identity['email']]);
    $user = $stmt->fetch();

    if (!$user) {
        $base = preg_replace('/[^a-z0-9_-]/', '', strtolower((string)strstr($identity['email'], '@', true))) ?: 'user';
        $base = substr($base, 0, 42);
        $username = $base; $n = 1;
        while (true) {
            $check = $pdo->prepare('SELECT 1 FROM users WHERE username = :username LIMIT 1');
            $check->execute([':username' => $username]);
            if (!$check->fetchColumn()) break;
            $username = substr($base, 0, 42) . $n++;
        }
        $id = $identity['uid'];
        $insert = $pdo->prepare("INSERT INTO users (id, full_name, username, password_hash, role, is_active, email, google_sub, auth_provider) VALUES (:id, :name, :username, :password_hash, 'staff', 1, :email, :firebase_uid, :provider)");
        $insert->execute([
            ':id' => $id, ':name' => $identity['name'] ?: $username, ':username' => $username,
            ':password_hash' => bin2hex(random_bytes(32)), ':email' => $identity['email'],
            ':firebase_uid' => $identity['uid'], ':provider' => $identity['google'] ? 'google' : 'email',
        ]);
        $user = ['id'=>$id, 'full_name'=>$identity['name'] ?: $username, 'username'=>$username, 'password_hash'=>'', 'role'=>'staff', 'is_active'=>1, 'email'=>$identity['email'], 'google_sub'=>$identity['uid'], 'auth_provider'=>$identity['google'] ? 'google' : 'email'];
    } else {
        if (!(int)$user['is_active']) json_out(['error' => 'This account is deactivated. Ask the owner.'], 403);
        $name = $identity['name'] ?: $user['full_name'];
        $stmt = $pdo->prepare("UPDATE users SET email = :email, google_sub = :firebase_uid, auth_provider = :provider, full_name = :name WHERE id = :id");
        $stmt->execute([':email'=>$identity['email'], ':firebase_uid'=>$identity['uid'], ':provider'=>$identity['google'] ? 'google' : 'email', ':name'=>$name, ':id'=>$user['id']]);
        $user['email'] = $identity['email']; $user['google_sub'] = $identity['uid']; $user['auth_provider'] = $identity['google'] ? 'google' : 'email'; $user['full_name'] = $name;
    }
    unset($user['password_hash']);
    return $user;
}
