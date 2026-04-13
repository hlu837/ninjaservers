// Storage utilities for identity persistence

export interface StoredIdentity {
  recoveryPhrase: string;
  did: string;
  publicKey: string;
  createdAt: string;
  email?: string;
}

const IDENTITY_KEY = 'ninja_identity';
const SESSION_KEY = 'ninja_session';

export function saveIdentity(identity: StoredIdentity): void {
  try {
    localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
  } catch (error) {
    console.error('Failed to save identity to localStorage:', error);
  }
}

export function loadIdentity(): StoredIdentity | null {
  try {
    const stored = localStorage.getItem(IDENTITY_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.error('Failed to load identity from localStorage:', error);
    return null;
  }
}

export function deleteIdentity(): void {
  try {
    localStorage.removeItem(IDENTITY_KEY);
  } catch (error) {
    console.error('Failed to delete identity from localStorage:', error);
  }
}

export function saveSession(sessionData: any): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
  } catch (error) {
    console.error('Failed to save session to localStorage:', error);
  }
}

export function loadSession(): any | null {
  try {
    const stored = localStorage.getItem(SESSION_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.error('Failed to load session from localStorage:', error);
    return null;
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch (error) {
    console.error('Failed to clear session from localStorage:', error);
  }
}