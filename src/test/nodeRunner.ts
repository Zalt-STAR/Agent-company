import { JSDOM, VirtualConsole } from 'jsdom';
import * as esbuild from 'esbuild-wasm';
import type { FileMap, PreviewReport } from '../types';
import { bundleProject } from '../runtime/bundle';
import { composeHtml } from '../runtime/preview';

let ready: Promise<void> | null = null;
const init = () => (ready ??= esbuild.initialize({}));

/** A universal no-op 2D context so canvas games can run under jsdom. */
function fakeContext(): unknown {
  const handler: ProxyHandler<() => unknown> = {
    get: (_t, prop) => (prop === Symbol.toPrimitive ? () => 0 : proxy),
    set: () => true,
    apply: () => proxy,
  };
  const proxy: unknown = new Proxy(function () {}, handler);
  return proxy;
}

export async function buildForNode(files: FileMap) {
  await init();
  const bundle = await bundleProject(esbuild, files);
  return { bundle, html: composeHtml(bundle) };
}

/** Node equivalent of the browser's iframe runner: same bundle, same shim, run in jsdom. */
export async function nodePreviewRunner(files: FileMap, filesVersion: number, tick: number): Promise<PreviewReport> {
  const report: PreviewReport = { filesVersion, tick, ok: false, errors: [], warnings: [], logs: [] };
  const { bundle, html } = await buildForNode(files);
  if (!bundle.ok) {
    report.buildError = bundle.error;
    return report;
  }
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (e) => {
    const detail = (e as { detail?: Error }).detail;
    const msg = detail?.name ? `${detail.name}: ${detail.message}` : e.message.replace(/^Uncaught \[(.*)\]$/, '$1');
    if (!report.errors.some((x) => x.includes(msg))) report.errors.push(msg);
  });
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole,
    beforeParse(window) {
      (window.HTMLCanvasElement.prototype as unknown as { getContext: () => unknown }).getContext = () => fakeContext();
    },
  });
  const { window } = dom;
  await new Promise<void>((resolve) => {
    const done = setTimeout(resolve, 3000);
    window.addEventListener('message', (e) => {
      const d = e.data as { __studio?: boolean; level: string; text: string };
      if (!d?.__studio) return;
      if (d.level === 'error') {
        if (!report.errors.some((x) => x.includes(d.text) || d.text.includes(x))) report.errors.push(d.text);
      } else if (d.level === 'warn') report.warnings.push(d.text);
      else if (d.level === 'ready') setTimeout(() => window.postMessage({ __studioSmoke: true }, '*'), 50);
      else if (d.level === 'smoke') {
        clearTimeout(done);
        setTimeout(resolve, 200);
      } else report.logs.push(d.text);
    });
  });
  window.close();
  report.ok = report.errors.length === 0;
  return report;
}
