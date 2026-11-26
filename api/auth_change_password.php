<?php
require_once __DIR__ . '/auth.php'; require_key();
$user=require_session(); $input=request_json(); $current=(string)($input['current_password']??''); $next=(string)($input['new_password']??''); $confirm=(string)($input['confirm_password']??'');
$rows=supabase_query('users',['id'=>'eq.'.$user['id'],'select'=>'password_hash','limit'=>'1']); $hash=(string)($rows[0]['password_hash']??'');
if ($current==='' || !password_verify($current,$hash)) json_out(['error'=>'Recent password is incorrect.'],422);
if (!preg_match('/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{6,}$/',$next)) json_out(['error'=>'New password needs 6+ characters, uppercase, lowercase, number, and special character.'],422);
if ($next !== $confirm) json_out(['error'=>'New password and confirmation do not match.'],422);
if ($current === $next) json_out(['error'=>'New password must be different from the recent password.'],422);
supabase_request('users','PATCH','id=eq.'.rawurlencode($user['id']),[['password_hash'=>password_hash($next,PASSWORD_DEFAULT)]],'return=minimal'); json_out(['ok'=>true]);
