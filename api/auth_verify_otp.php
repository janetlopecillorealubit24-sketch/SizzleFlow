<?php
require_once __DIR__ . '/auth.php'; require_key();
$input=request_json(); $email=strtolower(trim((string)($input['email']??''))); $otp=trim((string)($input['otp']??''));
$users=supabase_query('users',['email'=>'eq.'.$email,'select'=>auth_select().',password_hash','limit'=>'1']); $user=$users[0]??null;
if (!$user || !preg_match('/^\d{6}$/',$otp)) json_out(['error'=>'Invalid verification code.'],422);
$rows=supabase_query('auth_otps',['user_id'=>'eq.'.$user['id'],'order'=>'created_at.desc','select'=>'id,otp_hash,attempts,expires_at','limit'=>'1']); $record=$rows[0]??null;
if (!$record || strtotime($record['expires_at']) < time()) json_out(['error'=>'This code has expired. Please request a new one.'],410);
if ((int)$record['attempts'] >= 5) json_out(['error'=>'Too many attempts. Please request a new code.'],429);
if (!password_verify($otp,$record['otp_hash'])) { supabase_request('auth_otps','PATCH','id=eq.'.rawurlencode($record['id']),[['attempts'=>(int)$record['attempts']+1]],'return=minimal'); json_out(['error'=>'Incorrect code. '.max(0,4-(int)$record['attempts']).' attempts remaining.'],422); }
supabase_request('users','PATCH','id=eq.'.rawurlencode($user['id']),[['email_verified'=>true]],'return=minimal');
supabase_request('auth_otps','DELETE','id=eq.'.rawurlencode($record['id']),null,'return=minimal'); $user['email_verified']=true; create_session($user); json_out(['user'=>public_user($user)]);
