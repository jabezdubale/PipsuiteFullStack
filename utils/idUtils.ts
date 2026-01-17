// Simple ID helper to avoid collisions from Date.now().
// Uses crypto.randomUUID when available, with a safe fallback.

export const generateId = (prefix?: string): string => {
  const g: any = typeof globalThis !== 'undefined' ? (globalThis as any) : {};
  const uuid: string = (g.crypto && typeof g.crypto.randomUUID === 'function')
    ? g.crypto.randomUUID()
    : `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}_${Math.random().toString(36).slice(2, 10)}`;
  return prefix ? `${prefix}_${uuid}` : uuid;
};
