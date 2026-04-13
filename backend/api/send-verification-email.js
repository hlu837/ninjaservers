import { upsertVerificationCode } from '../../supabaseClient.js';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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
    const resendApiKey = process.env.RESEND_API_KEY;

    if (!resendApiKey) {
      console.error('Missing environment variable: RESEND_API_KEY');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // Use Resend API instead of SMTP
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'NinjaServers <onboarding@resend.dev>', // Use your verified domain later
        to: [email],
        subject: 'Your NinjaServers Verification Code',
        html: `<p>Your verification code is: <strong>${code}</strong></p><p>It expires in 10 minutes.</p>`,
        text: `Your verification code is: ${code}. It expires in 10 minutes.`,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Resend API error: ${response.status} ${errorData}`);
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
}
