import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { createHmac } from 'crypto';
import { fileURLToPath } from 'url';
import { Pool } from 'pg';
import { getSecret } from './envSecrets.js';
import { upsertVerificationCode, getVerificationCode, deleteVerificationCode, upsertProfileIdentity, getProfileByEmail } from './supabaseClient.js';

// Check Supabase configuration on startup
const supabaseUrl = getSecret('SUPABASE_URL');
const supabaseServiceRoleKey = getSecret('SUPABASE_SERVICE_ROLE_KEY');
if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  process.exit(1);
} else {
  console.log('✅ Supabase configuration loaded successfully');
}

const app = express();
const PORT = process.env.PORT || 3000;

const databaseUrl = getSecret('DATABASE_URL') || process.env.DATABASE_URL;
const pool = databaseUrl
  ? new Pool({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } })
  : null;

if (!databaseUrl) {
  console.warn('⚠️ DATABASE_URL is not configured. /api/log-action and /api/logs/:email endpoints will not work until the database connection is provided.');
}

// Store verification codes in Supabase table `verification_codes`

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'https://crystal-flow-canvas.lovable.app,https://lovable.app,https://05f59140-ddfd-4a75-8f66-2fe297885424.lovableproject.com')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g., curl, Postman)
    if (!origin) {
      console.log('CORS: request without origin allowed');
      return callback(null, true);
    }

    const isAllowedOrigin = () => {
      // Allow wildcard (e.g., set ALLOWED_ORIGINS='*' in env)
      if (allowedOrigins.includes('*')) return true;

      // Allow exact matches from the configured allowlist
      if (allowedOrigins.includes(origin)) return true;

      // Allow any HTTPS subdomain of lovable.app (e.g. preview domains).
      // Some preview origins include extra dashes and identifiers.
      if (typeof origin === 'string') {
        // Strip the protocol and optional port for a simple hostname check.
        const hostname = origin.replace(/^https:\/\//i, '').split(':')[0];
        if (hostname === 'lovable.app' || hostname.endsWith('.lovable.app')) return true;
      }

      return false;
    };

    const allowed = isAllowedOrigin();
    console.log(`CORS: origin=${origin} allowed=${allowed}`);

    if (allowed) {
      console.log(`CORS: allowing origin ${origin}`);
      return callback(null, true);
    }

    console.warn(`CORS: blocking origin ${origin}`);
    // Do not send CORS headers for disallowed origins.
    return callback(null, false);
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
};

app.use(cors(corsOptions));
app.use(express.json());

// Simple request logging to help debug API calls
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`, req.body);
  next();
});

app.get('/', (req, res) => {
  res.send(
    "Server is running. Use /api/debug to check env vars or POST to /api/send-verification-email to send a code."
  );
});

app.get('/api/debug', async (req, res) => {
  res.json({
    env: {
      BREVO_API_KEY: !!process.env.BREVO_API_KEY,
      SUPABASE_URL: !!process.env.SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      PORT: process.env.PORT || null,
    },
  });
});

app.post('/api/send-verification-email', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email required' });
  }

  // Generate 6-digit verification code
  const code = Math.floor(100000 + Math.random() * 900000).toString();

  // Store code with timestamp (expires in 10 minutes)
  const { error: storeError } = await upsertVerificationCode(email, code);
  if (storeError) {
    console.error('Supabase store error:', storeError);
    return res.status(500).json({ error: 'Failed to store verification code' });
  }

  try {
    const brevoApiKey = process.env.BREVO_API_KEY;

    if (!brevoApiKey) {
      console.error('Missing environment variable: BREVO_API_KEY');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // Use Brevo API
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': brevoApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: { email: 'hilinayared438@gmail.com' },
        to: [{ email }],
        subject: 'Your NinjaServers Verification Code',
        htmlContent: `<p>Your verification code is: <strong>${code}</strong></p><p>It expires in 10 minutes.</p>`,
        textContent: `Your verification code is: ${code}. It expires in 10 minutes.`,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Brevo API error: ${response.status} ${errorData}`);
    }

    res.json({ message: 'Verification email sent' });
  } catch (error) {
    console.error('Email sending error:', error);
    // Return the underlying error message + stack for debugging (safe for dev; remove in production)
    res.status(500).json({
      error: 'Failed to send email',
      detail: error?.message || String(error),
      stack: error?.stack
    });
  }
});

app.post('/api/verify-email', async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) {
    return res.status(400).json({ error: 'Email and code required' });
  }

  const { data: stored, error: fetchError } = await getVerificationCode(email);
  if (fetchError) {
    console.error('Supabase fetch error:', fetchError);
    return res.status(500).json({ error: 'Failed to retrieve verification code' });
  }

  if (!stored) {
    return res.status(400).json({ error: 'No verification code found' });
  }

  const storedTimestamp = new Date(stored.created_at).getTime();
  if (Date.now() - storedTimestamp > 10 * 60 * 1000) {
    await deleteVerificationCode(email);
    return res.status(400).json({ error: 'Verification code expired' });
  }

  if (stored.code !== code) {
    return res.status(400).json({ error: 'Invalid verification code' });
  }

  await deleteVerificationCode(email);
  res.json({ message: 'Email verified successfully' });
});

app.post('/api/log-action', async (req, res) => {
  if (!pool) {
    return res.status(503).json({ error: 'Database connection not configured' });
  }

  const { email, event, detail } = req.body;
  if (!email || !event) {
    return res.status(400).json({ message: 'email and event required' });
  }

  try {
    await pool.query(
      'INSERT INTO network_logs (email, event, detail) VALUES ($1, $2, $3)',
      [email, event, detail || null]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Network log insert error:', error);
    res.status(500).json({ error: 'Failed to log action' });
  }
});

app.get('/api/logs/:email', async (req, res) => {
  if (!pool) {
    return res.status(503).json({ error: 'Database connection not configured' });
  }

  const { email } = req.params;
  if (!email) {
    return res.status(400).json({ error: 'Email parameter required' });
  }

  try {
    const result = await pool.query(
      'SELECT event, detail, created_at FROM network_logs WHERE email = $1 ORDER BY created_at DESC LIMIT 50',
      [email]
    );
    res.json({ logs: result.rows });
  } catch (error) {
    console.error('Network log query error:', error);
    res.status(500).json({ error: 'Failed to retrieve logs' });
  }
});

app.post('/api/register-id', async (req, res) => {
  console.log('--- START REGISTRATION ---');
  console.log('Payload:', req.body);

  const { email, public_key } = req.body;
  if (!email || !public_key) {
    return res.status(400).json({ error: 'Email and public_key are required' });
  }

  const normalizedPublicKey = String(public_key).trim();
  const hexRegex = /^[0-9a-fA-F]{64}$/;
  if (!hexRegex.test(normalizedPublicKey)) {
    return res.status(400).json({ error: 'public_key must be a valid 64-character hex string' });
  }

  const vbmSecret = getSecret('VBM_SECRET');
  if (!vbmSecret) {
    console.error('Missing VBM_SECRET');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const message = `${email}:${normalizedPublicKey}`;
  const vbmSeal = createHmac('sha256', vbmSecret).update(message).digest('hex');
  const ninja_id = `did:ninja:${normalizedPublicKey.slice(0, 10)}`;

  try {
    const { error: profileError } = await upsertProfileIdentity(email, normalizedPublicKey, ninja_id, vbmSeal);
    if (profileError) {
      console.error('Supabase profile update error:', profileError);
      return res.status(500).json({ error: 'Failed to register ninja identity' });
    }

    if (pool) {
      try {
        await pool.query(
          'INSERT INTO network_logs (email, event, detail) VALUES ($1, $2, $3)',
          [email, 'IDENTITY_REGISTERED', 'Ninja ID created and anchored to network']
        );
      } catch (logError) {
        console.error('Network log insert error after registration:', logError);
      }
    } else {
      console.warn('Skipping identity registration log because DATABASE_URL is not configured.');
    }

    console.log('✅ Registration successful for:', email);
    res.json({ message: 'Ninja identity registered', ninja_id, vbm_seal: vbmSeal });
  } catch (error) {
    console.error('Supabase Error:', error);
    return res.status(500).json({ error: 'Database error during registration' });
  }
});

app.post('/api/check-identity', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email required' });
  }

  try {
    const { data, error } = await getProfileByEmail(email);

    if (error) {
      console.error('Supabase profile lookup error:', error);
      return res.status(500).json({ error: 'Failed to check identity' });
    }

    res.json({ exists: !!data });
  } catch (error) {
    console.error('Supabase Error:', error);
    res.status(500).json({ error: 'Database error during identity check' });
  }
});

// On Vercel, the server is run as a serverless function and should not call listen().
// When running locally (node server.js), start the server normally.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// If this file was executed directly (node server.js), start the listener.
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

export default app;