import type { Design, FileMap, Spec } from '../../../types';

/** A deliberate imperfection in an engineer's first submission, so the mock exercises review and QA loops. */
export type Flaw =
  | { kind: 'debugLog'; path: string; anchor: string; line: string }
  | { kind: 'bug'; path: string; find: string; replace: string };

export interface TemplateTicket {
  key: string;
  title: string;
  description: string;
  acceptance: string[];
  priority: 1 | 2 | 3;
  files: string[];
  /** Files this ticket writes as stubs rather than their final content. */
  stubs?: string[];
  dependsOn: string[];
  commitNote: string;
  /** flaws[n] is applied to submission attempt n. */
  flaws?: Flaw[];
}

export interface ProjectTemplate {
  id: string;
  match: RegExp;
  spec: Spec;
  design: Design;
  tickets: TemplateTicket[];
  final: FileMap;
  stubs: FileMap;
}

export function splitGlob(raw: Record<string, string>, id: string): { final: FileMap; stubs: FileMap } {
  const final: FileMap = {};
  const stubs: FileMap = {};
  for (const [k, v] of Object.entries(raw)) {
    const m = new RegExp(`^\\./${id}/(final|stubs)/(.+)$`).exec(k);
    if (!m) continue;
    (m[1] === 'final' ? final : stubs)[m[2]] = v;
  }
  return { final, stubs };
}
