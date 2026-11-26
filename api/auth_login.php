<?php
require_once __DIR__ . '/auth.php'; require_key();
$input=request_json(); $email=strtolower(trim((string)($input['email']??''))); $password=(string)($input['password']??'');
$rows=supabase_query('users',['email'=>'eq.'.$email,'select'=>auth_select().',password_hash','limit'=>'1']); $user=$rows[0]??null;
if (!$user || empty($user['is_active']) || !password_verify($password,(string)($user['password_hash']??''))) json_out(['error'=>'Incorrect email or password.'],401);
if (empty($user['email_verified']) && ($user['auth_provider']??'password')==='password') json_out(['error'=>'Please verify your email before logging in.'],403);
create_session($user); json_out(['user'=>public_user($user)]);
