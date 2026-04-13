This folder contains the backend server code copied from the repository root for easier deployment.

Files:
- server.js
- supabaseClient.js
- envSecrets.js
- verify-backend.js
- api/send-verification-email.js
- api/verify-email.js

Notes:
- Environment/secrets are read via `envSecrets.js` (looks for `/etc/secrets/<NAME>` or falls back to env vars).
- To run locally from the `backend/` folder:
  1. Ensure you have node and npm installed.
  2. Set required env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VBM_SECRET`, `DATABASE_URL`, `BREVO_API_KEY` (or change email logic).
  3. From repository root run: `node backend/server.js`

If you want me to delete the original root copies after you confirm this layout works, tell me and I'll remove them.