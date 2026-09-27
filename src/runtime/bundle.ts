import type { Plugin } from 'esbuild-wasm';
import type { FileMap } from '../types';

type EsbuildApi = typeof import('esbuild-wasm');

export interface BundleResult {
  ok: boolean;
  js: string;
  css: string;
  usesReact: boolean;
  entry?: string;
  error?: string;
  bodyHtml: string;
  headHtml: string;
}

const EXTS = ['', '.js', '.jsx', '.ts', '.tsx', '.mjs', '.json', '.css', '/index.js', '/index.jsx', '/index.ts', '/index.tsx'];
const ENTRY_CANDIDATES = ['src/main.js', 'src/main.jsx', 'src/main.tsx', 'src/main.ts', 'src/index.js', 'src/index.jsx', 'main.js', 'index.js', 'app.js'];
const REACT_IDS = /^(react|react-dom|react-dom\/client|react\/jsx-runtime|react\/jsx-dev-runtime)$/;

function normalize(path: string): string {
  const out: string[] = [];
  for (const part of path.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') out.pop();
    else out.push(part);
  }
  return out.join('/');
}

function dirname(p: string) {
  const i = p.lastIndexOf('/');
  return i < 0 ? '' : p.slice(0, i);
}

function loaderFor(path: string) {
  const ext = path.slice(path.lastIndexOf('.') + 1);
  return (['js', 'jsx', 'ts', 'tsx', 'css', 'json'].includes(ext) ? ext : ext === 'mjs' ? 'js' : 'text') as
    | 'js'
    | 'jsx'
    | 'ts'
    | 'tsx'
    | 'css'
    | 'json'
    | 'text';
}

/** Parse the project's index.html: find the module entry, inline local stylesheets, keep the rest of the markup. */
export function readHtml(files: FileMap): { entry?: string; head: string; body: string; linkedCss: string } {
  const html = files['index.html'];
  if (!html) return { head: '', body: '<div id="root"></div><div id="app"></div>', linkedCss: '' };
  let entry: string | undefined;
  let linkedCss = '';
  const strip = (s: string) =>
    s
      .replace(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>\s*<\/script>/gi, (_m, src: string) => {
        if (/^https?:/.test(src)) return '';
        entry ??= normalize(src);
        return '';
      })
      .replace(/<link\b[^>]*\bhref=["']([^"']+)["'][^>]*>/gi, (m, href: string) => {
        if (!/stylesheet/i.test(m)) return m;
        const css = files[normalize(href)];
        if (css !== undefined) linkedCss += `\n${css}`;
        return '';
      });
  const headMatch = /<head[^>]*>([\s\S]*?)<\/head>/i.exec(html);
  const bodyMatch = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(html);
  const head = strip(headMatch?.[1] ?? '').replace(/<meta\s+charset[^>]*>/i, '');
  const body = strip(bodyMatch?.[1] ?? html.replace(/<!doctype[^>]*>|<\/?html[^>]*>|<head[\s\S]*<\/head>/gi, ''));
  return { entry, head, body, linkedCss };
}

export async function bundleProject(esbuild: EsbuildApi, files: FileMap): Promise<BundleResult> {
  const { entry: htmlEntry, head, body, linkedCss } = readHtml(files);
  const entry = htmlEntry && files[htmlEntry] !== undefined ? htmlEntry : ENTRY_CANDIDATES.find((c) => files[c] !== undefined);
  const base = { js: '', css: linkedCss, usesReact: false, bodyHtml: body, headHtml: head };
  if (!entry) {
    return { ...base, ok: false, error: 'No entry file found. Add index.html with <script type="module" src="./src/main.js"> or create src/main.js.' };
  }

  let usesReact = false;
  const vfs: Plugin = {
    name: 'studio-vfs',
    setup(build) {
      build.onResolve({ filter: REACT_IDS }, (args) => {
        usesReact = true;
        return { path: args.path, namespace: 'react-global' };
      });
      build.onLoad({ filter: /.*/, namespace: 'react-global' }, (args) => ({
        contents: args.path.startsWith('react-dom') ? 'module.exports = window.ReactDOM;' : 'module.exports = window.React;',
        loader: 'js',
      }));
      build.onResolve({ filter: /.*/ }, (args) => {
        if (args.kind === 'entry-point') return { path: normalize(args.path), namespace: 'vfs' };
        if (!args.path.startsWith('.') && !args.path.startsWith('/')) {
          return { errors: [{ text: `External package "${args.path}" is not available. Projects must be self-contained (only React is provided).` }] };
        }
        const from = args.path.startsWith('/') ? '' : args.resolveDir;
        const target = normalize(`${from}/${args.path}`);
        const hit = EXTS.map((e) => target + e).find((p) => files[p] !== undefined);
        if (!hit) return { errors: [{ text: `Could not resolve "${args.path}" from ${args.importer || 'entry'}` }] };
        return { path: hit, namespace: 'vfs' };
      });
      build.onLoad({ filter: /.*/, namespace: 'vfs' }, (args) => ({
        contents: files[args.path],
        loader: loaderFor(args.path),
        resolveDir: '/' + dirname(args.path),
      }));
    },
  };

  try {
    const result = await esbuild.build({
      entryPoints: [entry],
      bundle: true,
      write: false,
      format: 'iife',
      outdir: 'out',
      target: 'es2020',
      jsx: 'transform',
      jsxFactory: 'React.createElement',
      jsxFragment: 'React.Fragment',
      logLevel: 'silent',
      plugins: [vfs],
    });
    let js = '';
    let css = linkedCss;
    for (const f of result.outputFiles ?? []) {
      if (f.path.endsWith('.css')) css += `\n${f.text}`;
      else if (f.path.endsWith('.js')) js = f.text;
    }
    return { ...base, ok: true, js, css, usesReact, entry };
  } catch (e) {
    const err = e as { errors?: { text: string; location?: { file: string; line: number } | null }[]; message?: string };
    const first = err.errors?.[0];
    const where = first?.location ? ` (${first.location.file.replace(/^vfs:/, '')}:${first.location.line})` : '';
    return { ...base, ok: false, entry, error: first ? `Build error: ${first.text}${where}` : `Build error: ${err.message}` };
  }
}

/** Guard against a script body closing the inline <script> tag early. */
export const safeInline = (code: string) => code.replace(/<\/script/gi, '<\\/script');
