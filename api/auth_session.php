<?php require_once __DIR__ . '/auth.php'; require_key(); $user=session_user(); json_out(['user'=>$user?public_user($user):null]);
