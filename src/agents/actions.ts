import { z } from 'zod';

const str = z.string();
const strList = z.array(z.string());

export const TicketDraftSchema = z.object({
  title: str.min(1),
  description: str.default(''),
  acceptance: strList.min(1),
  priority: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(2),
  files: strList.default([]),
  dependsOn: strList.default([]),
  assignee: str.optional(),
  templateKey: str.optional(),
});
export type TicketDraft = z.infer<typeof TicketDraftSchema>;

export const SpecSchema = z.object({
  title: str.min(1),
  summary: str.min(1),
  kind: z.enum(['app', 'game']),
  stack: z.enum(['vanilla', 'react']).default('vanilla'),
  features: strList.default([]),
  outOfScope: strList.default([]),
  templateId: str.optional(),
});

export const DesignSchema = z.object({
  summary: str.min(1),
  screens: strList.min(1),
  flow: strList.default([]),
  palette: z.record(z.string(), z.string()),
  typography: str.min(1),
  spacing: str.min(1),
  coreLoop: str.optional(),
  controls: str.optional(),
  artDirection: str.optional(),
});

const BugSchema = z.object({
  title: str.min(1),
  steps: strList.min(1),
  expected: str.min(1),
  actual: str.min(1),
});

export const ActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('noop') }),
  z.object({ type: z.literal('write_spec'), spec: SpecSchema, tickets: z.array(TicketDraftSchema).min(1).max(8) }),
  z.object({ type: z.literal('create_ticket'), ticket: TicketDraftSchema }),
  z.object({
    type: z.literal('update_ticket'),
    ticketId: str,
    title: str.optional(),
    description: str.optional(),
    acceptance: strList.optional(),
    assignee: str.optional(),
    priority: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
    files: strList.optional(),
  }),
  z.object({ type: z.literal('ask_user'), question: str.min(1), options: strList.default([]) }),
  z.object({ type: z.literal('ship'), note: str.default('') }),
  z.object({ type: z.literal('write_design'), design: DesignSchema }),
  z.object({ type: z.literal('claim_ticket'), ticketId: str }),
  z.object({
    type: z.literal('write_code'),
    ticketId: str,
    edits: z.array(z.object({ path: str.min(1), content: str })).min(1),
    commitNote: str.min(1),
    readyForReview: z.boolean().default(false),
  }),
  z.object({
    type: z.literal('review'),
    ticketId: str,
    verdict: z.enum(['approve', 'request_changes']),
    comments: str.default(''),
  }),
  z.object({
    type: z.literal('qa_result'),
    ticketId: str,
    verdict: z.enum(['pass', 'fail']),
    notes: str.default(''),
    bug: BugSchema.optional(),
  }),
  z.object({
    type: z.literal('file_bug'),
    title: str.min(1),
    steps: strList.min(1),
    expected: str.min(1),
    actual: str.min(1),
    files: strList.default([]),
  }),
]);

export type Action = z.infer<typeof ActionSchema>;
export type ActionType = Action['type'];

export const AgentResponseSchema = z.object({
  reasoning: str.default(''),
  action: ActionSchema,
  message: z
    .object({ text: str.min(1), mentions: strList.default([]) })
    .nullable()
    .optional(),
});
export type AgentResponse = z.infer<typeof AgentResponseSchema>;

/** Pull the first balanced JSON object out of a model response (tolerates ``` fences and prose). */
export function extractJson(raw: string): unknown {
  const text = raw.trim();
  try {
    return JSON.parse(text);
  } catch {
    /* fall through */
  }
  const start = text.indexOf('{');
  if (start < 0) throw new Error('No JSON object found in response');
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return JSON.parse(text.slice(start, i + 1));
    }
  }
  throw new Error('Unterminated JSON object in response');
}

export function parseAgentResponse(raw: string): { ok: true; value: AgentResponse } | { ok: false; error: string } {
  let json: unknown;
  try {
    json = extractJson(raw);
  } catch (e) {
    return { ok: false, error: `Invalid JSON: ${(e as Error).message}` };
  }
  const res = AgentResponseSchema.safeParse(json);
  if (!res.success) {
    const issues = res.error.issues
      .slice(0, 5)
      .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('; ');
    return { ok: false, error: `Schema validation failed: ${issues}` };
  }
  return { ok: true, value: res.data };
}

export function summarizeAction(a: Action): string {
  switch (a.type) {
    case 'noop':
      return 'No action';
    case 'write_spec':
      return `Wrote spec "${a.spec.title}" with ${a.tickets.length} tickets`;
    case 'create_ticket':
      return `Created ticket "${a.ticket.title}"`;
    case 'update_ticket':
      return `Rescoped ${a.ticketId}`;
    case 'ask_user':
      return `Asked the user: ${a.question}`;
    case 'ship':
      return 'Shipped the project';
    case 'write_design':
      return 'Wrote the design doc';
    case 'claim_ticket':
      return `Claimed ${a.ticketId}`;
    case 'write_code':
      return `Committed ${a.edits.length} file(s) on ${a.ticketId}${a.readyForReview ? ' → Review' : ''}`;
    case 'review':
      return `${a.verdict === 'approve' ? 'Approved' : 'Requested changes on'} ${a.ticketId}`;
    case 'qa_result':
      return `QA ${a.verdict === 'pass' ? 'passed' : 'failed'} ${a.ticketId}`;
    case 'file_bug':
      return `Filed bug "${a.title}"`;
  }
}
