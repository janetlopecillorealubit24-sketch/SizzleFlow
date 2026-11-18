SIZZLEFLOW - HOW TO USE
=======================
1. Put this whole "SizzleFlow" folder inside:  C:\xampp\htdocs\
   Result:  C:\xampp\htdocs\SizzleFlow\app\index.html

2. XAMPP Control Panel: start Apache and MySQL.

3. Open http://localhost/phpmyadmin > Import > choose database_sizzleflow.sql > Go.

4. Open the app:  http://localhost/SizzleFlow/app/
   Login: manager / sizzle123   (staff1 .. staff6, same password)

5. In VS Code: File > Open Folder > C:\xampp\htdocs\SizzleFlow  (only this one folder).

FOLDERS
  app\   the screens people see (index.html, style.css, app.js, db.js ...)
  api\   the PHP backend (config.php holds the API key and database login)
  database_sizzleflow.sql   import once in phpMyAdmin

TEST THE BACKEND:  http://localhost/SizzleFlow/api/ping.php
  Seeing {"error":"Unauthorized"} means it works.

EDIT + PREVIEW: save a file (Ctrl+S) then press Ctrl+Shift+R in Chrome.
In the app, Settings > Test server, then Sync now.
