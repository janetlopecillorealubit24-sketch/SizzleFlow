# Deploy the SizzleFlow API to Render

This deploys only the PHP API. Keep the existing frontend online until the new
API has passed login and sync tests.

1. Push this repository to GitHub.
2. In Render, choose **New > Web Service** and select the SizzleFlow repository.
3. Set **Language** to `Docker` and **Root Directory** to `api`.
4. Create the service. Render gives it an HTTPS URL such as
   `https://sizzleflow-api.onrender.com`.
5. In **Environment**, add these secret environment variables from the existing
   `api/config.local.php` file. Do not commit their values:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
   - `API_KEY`
   - `GOOGLE_CLIENT_ID`
6. Redeploy, then open `/ping.php` on the new Render URL. It must return JSON
   with `"ok":true`.
7. Only after that test succeeds, set `window.SIZZLEFLOW_API_URL` in
   `app/runtime-config.js` to the new Render URL (without a trailing slash),
   upload that file to the existing frontend, and test Google sign-in and sync.

The free Render web service may sleep after inactivity, so its first request
can take roughly a minute. Supabase remains the database; no Render database is
needed.
