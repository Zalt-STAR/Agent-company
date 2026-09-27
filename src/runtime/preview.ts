import type { FileMap, PreviewReport } from '../types';
import { bundleProject, safeInline } from './bundle';
import type { BundleResult } from './bundle';
import { PREVIEW_SHIM } from './shim';
import reactUmd from '@react-umd?raw';
import reactDomUmd from '@react-dom-umd?raw';

type EsbuildApi = typeof import('esbuild-wasm');
let esbuildReady: Promise<EsbuildApi> | null = null;

export function getEsbuild(): Promise<EsbuildApi> {
  esbuildReady ??= (async () => {
    const [esbuild, { default: wasmURL }] = await Promise.all([import('esbuild-wasm'), import('esbuild-wasm/esbuild.wasm?url')]);
    await esbuild.initialize({ wasmURL, worker: true });
    return esbuild;
  })();
  return esbuildReady;
}

export function composeHtml(b: BundleResult, opts: { shim?: boolean } = { shim: true }): string {
  const reactScripts = b.usesReact ? `<script>${safeInline(reactUmd)}</script><script>${safeInline(reactDomUmd)}</script>` : '';
  const errorBody = b.ok
    ? ''
    : `<pre style="color:#f87171;background:#1c1917;padding:16px;margin:0;white-space:pre-wrap;font:13px ui-monospace,monospace">${b.error?.replace(/</g, '&lt;')}</pre>`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
${opts.shim === false ? '' : `<script>${PREVIEW_SHIM}</script>`}
${b.headHtml}
<style>${b.css.replace(/<\/style/gi, '<\\/style')}</style>
</head>
<body>
${b.bodyHtml}
${errorBody}
${reactScripts}
${b.ok ? `<script>${safeInline(b.js)}</script>` : ''}
</body>
</html>`;
}

export async function buildHtml(files: FileMap, opts?: { shim?: boolean }): Promise<{ html: string; bundle: BundleResult }> {
  const esbuild = await getEsbuild();
  const bundle = await bundleProject(esbuild, files);
  return { html: composeHtml(bundle, opts), bundle };
}

export type PreviewRunner = (files: FileMap, filesVersion: number, tick: number) => Promise<PreviewReport>;

/**
 * Headless check used by QA and the Producer: build the project, run it in an off-screen sandboxed
 * iframe, run a short smoke test, and collect console output.
 */
export const iframePreviewRunner: PreviewRunner = async (files, filesVersion, tick) => {
  const report: PreviewReport = { filesVersion, tick, ok: false, errors: [], warnings: [], logs: [] };
  let built: { html: string; bundle: BundleResult };
  try {
    built = await buildHtml(files);
  } catch (e) {
    report.buildError = `Bundler failed to start: ${(e as Error).message}`;
    return report;
  }
  if (!built.bundle.ok) {
    report.buildError = built.bundle.error;
    return report;
  }

  const frame = document.createElement('iframe');
  frame.setAttribute('sandbox', 'allow-scripts');
  frame.setAttribute('aria-hidden', 'true');
  frame.tabIndex = -1;
  Object.assign(frame.style, {
    position: 'fixed',
    right: '0',
    bottom: '0',
    width: '480px',
    height: '360px',
    opacity: '0',
    pointerEvents: 'none',
    zIndex: '-1',
    border: '0',
  });

  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.removeEventListener('message', onMessage);
      frame.remove();
      resolve();
    };
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frame.contentWindow || !e.data?.__studio) return;
      const { level, text } = e.data as { level: string; text: string };
      if (level === 'error') {
        if (!report.errors.includes(text)) report.errors.push(text);
      } else if (level === 'warn') report.warnings.push(text);
      else if (level === 'ready') {
        setTimeout(() => frame.contentWindow?.postMessage({ __studioSmoke: true }, '*'), 250);
      } else if (level === 'smoke') setTimeout(finish, 600);
      else report.logs.push(text);
    };
    window.addEventListener('message', onMessage);
    setTimeout(finish, 4000);
    frame.srcdoc = built.html;
    document.body.appendChild(frame);
  });

  report.ok = report.errors.length === 0;
  return report;
};
