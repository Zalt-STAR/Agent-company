// Browser smoke test: builds nothing itself — run `npm run build` first.
// Serves dist/, gives the studio a brief on the mock LLM, waits for it to ship,
// and checks the shipped game runs with no console errors.
//   npm run e2e -- "A Snake game"
// Set CHROMIUM_PATH to use a specific Chromium binary.
import { preview } from 'vite';
import { chromium } from 'playwright';

const brief = process.argv[2] ?? 'A Snake game';
const server = await preview({ preview: { port: 4317, strictPort: true } });
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
let failed = false;
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const studioErrors = [];
  page.on('pageerror', (e) => studioErrors.push(e.message));
  await page.goto('http://localhost:4317/');
  await page.locator('input').first().fill(brief);
  await page.getByRole('button', { name: 'Build it' }).click();
  await page.locator('header select').selectOption('4');

  await page.waitForFunction(() => window.studio?.['store'].getState().run.status !== 'running', null, { timeout: 180_000 });
  const s = await page.evaluate(() => {
    const s = window.studio['store'].getState();
    return { run: s.run, preview: s.preview, tickets: s.tickets.map((t) => `${t.id}:${t.column}`), question: s.questions.find((q) => !q.answer)?.text };
  });
  console.log(JSON.stringify(s, null, 2));
  if (s.run.status !== 'shipped') throw new Error(`Run ended as ${s.run.status}: ${s.run.pauseReason ?? s.question}`);
  if (!s.preview?.ok) throw new Error(`Shipped with preview errors: ${s.preview?.errors}`);

  await page.getByRole('button', { name: 'Play it' }).click();
  await page.waitForTimeout(1500);
  await page.frameLocator('iframe[title=Preview]').locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1000);
  const consoleErrors = await page.locator('text=/^✖/').count();
  if (consoleErrors) throw new Error(`Preview console shows ${consoleErrors} error(s) after starting`);
  await page.screenshot({ path: 'e2e-shipped.png' });
  console.log('✔ shipped and running; screenshot saved to e2e-shipped.png');
} catch (e) {
  failed = true;
  console.error('✖', e.message);
} finally {
  await browser.close();
  await new Promise((r) => server.httpServer.close(r));
}
process.exit(failed ? 1 : 0);
