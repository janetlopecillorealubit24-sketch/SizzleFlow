<?php
require_once __DIR__ . '/auth.php'; require_key();
$input = request_json();
$name = trim((string)($input['full_name'] ?? '')); $email = strtolower(trim((string)($input['email'] ?? ''))); $password = (string)($input['password'] ?? '');
if ($name === '' || strlen($name) > 100 || !filter_var($email, FILTER_VALIDATE_EMAIL)) json_out(['error'=>'Enter a valid full name and email address.'], 422);
if (!preg_match('/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{6,}$/', $password)) json_out(['error'=>'Password must be at least 6 characters and include uppercase, lowercase, number, and special character.'], 422);
$existing = supabase_query('users', ['email'=>'eq.'.$email, 'select'=>'id,email_verified', 'limit'=>'1']);
if ($existing && !empty($existing[0]['email_verified'])) json_out(['error'=>'That email is already registered.'], 409);
$userId = $existing[0]['id'] ?? uuid_v4();
$base = substr(preg_replace('/[^a-z0-9_-]/', '', strtolower((string)strstr($email, '@', true))) ?: 'user', 0, 42); $username=$base; $n=1;
while (($rows=supabase_query('users', ['username'=>'eq.'.$username, 'select'=>'id', 'limit'=>'1'])) && (!$existing || $rows[0]['id'] !== $userId)) $username=substr($base,0,42).$n++;
supabase_upsert('users', [[ 'id'=>$userId,'full_name'=>$name,'username'=>$username,'password_hash'=>password_hash($password, PASSWORD_DEFAULT),'role'=>'staff','is_active'=>true,'email'=>$email,'auth_provider'=>'password','email_verified'=>false ]]);
$otp = (string)random_int(100000,999999);
supabase_upsert('auth_otps', [[ 'id'=>uuid_v4(),'user_id'=>$userId,'email'=>$email,'otp_hash'=>password_hash($otp, PASSWORD_DEFAULT),'attempts'=>0,'expires_at'=>gmdate('c', time()+600) ]]);
try { gmail_send_otp($email, $otp); } catch (Throwable $e) { json_out(['error'=>$e->getMessage()], 503); }
json_out(['pending'=>true,'email'=>$email]);
