import { generateMnemonic, mnemonicToSeedSync } from '@scure/bip39';

// Generate a 12-word recovery phrase
export function generateRecoveryPhrase(): string {
  return generateMnemonic(128); // 128 bits = 12 words
}

// Derive a deterministic public key from recovery phrase using Web Crypto API
export async function derivePublicKeyFromPhrase(phrase: string): Promise<string> {
  const seed = mnemonicToSeedSync(phrase);

  // Use PBKDF2 with Web Crypto API
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    seed,
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: new TextEncoder().encode('ninja-salt'),
      iterations: 10000,
      hash: 'SHA-256'
    },
    keyMaterial,
    256 // 32 bytes
  );

  const keyArray = new Uint8Array(derivedBits);
  return Array.from(keyArray).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Generate DID from public key
export function generateDID(publicKey: string): string {
  return `did:ninja:${publicKey.slice(0, 10)}`;
}

// Complete identity generation
export async function generateIdentity() {
  const phrase = generateRecoveryPhrase();
  const publicKey = await derivePublicKeyFromPhrase(phrase);
  const did = generateDID(publicKey);

  return {
    recoveryPhrase: phrase,
    publicKey,
    did
  };
}

// Validate recovery phrase
export function validateRecoveryPhrase(phrase: string): boolean {
  try {
    mnemonicToSeedSync(phrase);
    return true;
  } catch {
    return false;
  }
}

// Regenerate identity from existing phrase
export async function regenerateIdentityFromPhrase(phrase: string) {
  if (!validateRecoveryPhrase(phrase)) {
    throw new Error('Invalid recovery phrase');
  }

  const publicKey = await derivePublicKeyFromPhrase(phrase);
  const did = generateDID(publicKey);

  return {
    recoveryPhrase: phrase,
    publicKey,
    did
  };
}</content>
<parameter name="filePath">c:\Users\user\Downloads\ninjaservers-master (1)\ninjaservers-master\src\lib\identity.ts