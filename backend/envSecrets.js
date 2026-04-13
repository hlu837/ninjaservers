import fs from 'fs';

const SECRET_DIR = '/etc/secrets';

function readSecretFile(name) {
  const filePath = `${SECRET_DIR}/${name}`;
  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf8').trim();
    }
  } catch (error) {
    // Ignore file read errors and allow fallback to environment variables.
  }
  return undefined;
}

export function getSecret(name) {
  const envValue = process.env[name];
  if (typeof envValue === 'string' && envValue.trim()) {
    return envValue.trim();
  }
  return readSecretFile(name);
}
