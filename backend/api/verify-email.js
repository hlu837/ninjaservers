import { getVerificationCode, deleteVerificationCode } from '../../supabaseClient.js';

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

  const { email, code } = req.body;
  if (!email || !code) {
    return res.status(400).json({ error: 'Email and code required' });
  }

  const { data: stored, error: fetchError } = await getVerificationCode(email);
  if (fetchError) {
    console.error('Supabase fetch error:', fetchError);
    return res.status(500).json({ error: 'Failed to retrieve verification code' });
  }

  if (!stored || stored.code !== code) {
    return res.status(400).json({ error: 'Invalid verification code' });
  }

  if (Date.now() - new Date(stored.created_at).getTime() > 10 * 60 * 1000) {
    await deleteVerificationCode(email);
    return res.status(400).json({ error: 'Verification code has expired' });
  }

  await deleteVerificationCode(email);
  res.status(200).json({ message: 'Email verified successfully' });
}
