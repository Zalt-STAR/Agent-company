import { MODES } from './timer.js';

export function createStats() {
  const sessions = [];
  return {
    record(mode) {
      if (mode !== 'work') return;
      sessions.push({ at: Date.now(), minutes: MODES.work.minutes });
    },
    summary() {
      return {
        focusSessions: sessions.length,
        focusMinutes: sessions.reduce((n, s) => n + s.minutes, 0),
      };
    },
  };
}
