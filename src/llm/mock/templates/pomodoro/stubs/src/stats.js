// Stub: replaced by the session stats ticket.
export function createStats() {
  return { record() {}, summary: () => ({ focusSessions: 0, focusMinutes: 0 }) };
}
