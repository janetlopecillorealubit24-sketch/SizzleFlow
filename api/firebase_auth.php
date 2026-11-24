<?php
require_once __DIR__ . '/firebase.php';
require_key();
json_out(['user' => firebase_user_row(firebase_identity())]);
