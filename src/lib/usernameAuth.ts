// Deterministic internal address; users never enter an email.
// UTF-8 hex encoding preserves every normalized username without collisions.
export function usernameToAuthEmail(username: string): string {
  const normalized = username.trim().toLowerCase();
  if (!normalized) throw new Error('Please enter your username.');
  const hex = Array.from(new TextEncoder().encode(normalized), b => b.toString(16).padStart(2, '0')).join('');
  if (hex.length > 64) throw new Error('Username must be at most 32 UTF-8 bytes.');
  return `${hex}@app.local`;
}