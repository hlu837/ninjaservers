const BASE_URL = process.env.BACKEND_URL || 'http://localhost:3000';

const headers = {
  'Content-Type': 'application/json',
};

function randomHex64() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, options);
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, ok: res.ok, body };
}

async function run() {
  console.log('Backend base URL:', BASE_URL);

  console.log('\n1) GET /api/debug');
  const debug = await request('/api/debug');
  console.log(debug);

  console.log('\n2) POST /api/register-id');
  const email = process.env.TEST_EMAIL || 'test+ninja@example.com';
  const public_key = process.env.TEST_PUBLIC_KEY || randomHex64();
  const register = await request('/api/register-id', {
    method: 'POST',
    headers,
    body: JSON.stringify({ email, public_key }),
  });
  console.log(register);

  if (register.ok) {
    console.log('\n✅ register-id appears to be wired correctly.');
  } else {
    console.log('\n⚠️ register-id returned an error.');
  }
}

run().catch((error) => {
  console.error('Test script failed:', error);
  process.exit(1);
});
