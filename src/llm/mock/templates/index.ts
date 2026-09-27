import type { ProjectTemplate } from './types';
import { pomodoro } from './pomodoro';
import { snake } from './snake';
import { habits } from './habits';
import { platformer } from './platformer';
import { dodge, quicklist } from './generic';

export type { ProjectTemplate, TemplateTicket, Flaw } from './types';

export const FIXED_TEMPLATES = [pomodoro, snake, habits, platformer];

const GAME_WORDS = /\b(game|play|arcade|shoot|dodge|runner|puzzle|survive)\b/i;
const APP_WORDS = /\b(app|tool|tracker|list|todo|to-do|manager|planner|notes?|organi[sz]er|dashboard|calculator)\b/i;

export type TemplateChoice = { template: ProjectTemplate } | { ambiguous: true };

export function chooseTemplate(brief: string, answer?: string): TemplateChoice {
  const text = `${brief} ${answer ?? ''}`;
  const fixed = FIXED_TEMPLATES.find((t) => t.match.test(text));
  if (fixed) return { template: fixed };
  if (answer) return { template: /game/i.test(answer) ? dodge(brief) : quicklist(brief) };
  if (GAME_WORDS.test(brief)) return { template: dodge(brief) };
  if (APP_WORDS.test(brief)) return { template: quicklist(brief) };
  return { ambiguous: true };
}

/** Re-derive a template from a spec's templateId (the spec is the durable record of the choice). */
export function templateById(id: string | undefined, brief: string): ProjectTemplate | undefined {
  if (!id) return undefined;
  if (id === 'quicklist') return quicklist(brief);
  if (id === 'dodge') return dodge(brief);
  return FIXED_TEMPLATES.find((t) => t.id === id);
}
