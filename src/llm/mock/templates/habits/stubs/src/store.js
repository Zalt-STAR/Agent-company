// Stub: replaced by the habit store ticket.
export const dayKey = (d) => d.toDateString();
export const lastDays = () => [];
export function createStore() {
  return { habits: [], add: () => false, remove() {}, toggle() {}, streak: () => 0, subscribe() {} };
}
