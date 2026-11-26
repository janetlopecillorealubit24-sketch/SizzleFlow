<?php
require_once __DIR__ . '/auth.php'; require_key();
$user=require_session(); $input=request_json(); $username=trim((string)($input['username']??''));
if (!preg_match('/^[A-Za-z0-9_-]{3,50}$/',$username)) json_out(['error'=>'Username must be 3-50 characters and use only letters, numbers, underscore, or hyphen.'],422);
$existing=supabase_query('users',['username'=>'eq.'.$username,'select'=>'id','limit'=>'1']);
if ($existing && (string)$existing[0]['id'] !== (string)$user['id']) json_out(['error'=>'That username is already in use.'],409);
supabase_request('users','PATCH','id=eq.'.rawurlencode($user['id']),[['username'=>$username]],'return=minimal');
$user['username']=$username; json_out(['user'=>public_user($user)]);
