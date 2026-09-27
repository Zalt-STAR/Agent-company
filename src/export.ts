import { strToU8, zipSync } from 'fflate';
import type { StudioState } from './types';
import { buildHtml } from './runtime/preview';

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'studio-project';
}

/** Zip the project sources plus a self-contained dist/index.html that runs by double-click. */
export async function exportZip(s: StudioState): Promise<{ blob: Blob; filename: string }> {
  const name = slug(s.spec?.title ?? s.brief);
  const entries: Record<string, Uint8Array> = {};
  for (const [path, content] of Object.entries(s.files)) entries[`${name}/${path}`] = strToU8(content);

  const { html, bundle } = await buildHtml(s.files, { shim: false });
  if (bundle.ok) entries[`${name}/dist/index.html`] = strToU8(html);

  const log = s.commits.map((c) => `- t${c.tick} ${c.id} [${c.author}${c.ticketId ? ` · ${c.ticketId}` : ''}] ${c.note}`).join('\n');
  entries[`${name}/README.md`] = strToU8(
    [
      `# ${s.spec?.title ?? 'Studio project'}`,
      '',
      s.spec?.summary ?? s.brief,
      '',
      '## Run it',
      bundle.ok ? '- Open `dist/index.html` directly in a browser (fully self-contained), or' : '',
      '- Serve this folder with any static server (e.g. `npx serve .`) and open `index.html`.',
      '',
      '## Built by the Studio team',
      s.agents.map((a) => `- ${a.avatar} ${a.name} — ${a.title}`).join('\n'),
      '',
      '## Commit log',
      log,
      '',
    ].join('\n'),
  );

  const zipped = zipSync(entries, { level: 6 });
  return { blob: new Blob([zipped as BlobPart], { type: 'application/zip' }), filename: `${name}.zip` };
}
