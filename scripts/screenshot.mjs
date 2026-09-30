import { mkdir } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

import { chromium } from "playwright";

/**
 * Capture the screens used in the project documentation.
 *
 * Drives a real Chromium against `next start`, signs in with the three demo
 * accounts, and writes PNGs to `docs/screenshots/`. Run it after `npm run build`:
 *
 *   npm run build && npm start        # in one terminal
 *   npm run screenshot                # in another
 *
 * Override the target with `SCREENSHOT_BASE_URL`.
 */

const BASE_URL = process.env.SCREENSHOT_BASE_URL ?? "http://localhost:3000";
const OUT_DIR = "docs/screenshots";

const VIEWPORT = { width: 1440, height: 900 };

/** One entry per screenshot: which account signs in, and what to capture. */
const SHOTS = [
  { file: "01-login.png", account: null, path: "/login" },
  { file: "02-dashboard-admin.png", account: "supervisor", path: "/dashboard" },
  { file: "03-dashboard-engineer.png", account: "engineer", path: "/dashboard" },
  { file: "04-assets.png", account: "engineer", path: "/assets" },
  { file: "05-asset-detail.png", account: "engineer", path: "FIRST_ASSET" },
  { file: "06-work-orders.png", account: "engineer", path: "/work-orders" },
  { file: "07-work-order-detail.png", account: "engineer", path: "FIRST_WORK_ORDER" },
  { file: "08-downtime.png", account: "engineer", path: "/downtime" },
  { file: "09-parts.png", account: "engineer", path: "/parts" },
  { file: "10-reports.png", account: "engineer", path: "/reports" },
  { file: "11-activity.png", account: "supervisor", path: "/activity" },
  { file: "12-dashboard-mobile.png", account: "engineer", path: "/dashboard", mobile: true },
  { file: "13-work-orders-planner.png", account: "planner", path: "/work-orders" },
  { file: "14-dashboard-dark.png", account: "supervisor", path: "/dashboard", dark: true },
];

const ACCOUNTS = {
  supervisor: { email: "supervisor@factory.th", password: "supervisor2026" },
  engineer: { email: "engineer@factory.th", password: "engineer2026" },
  planner: { email: "planner@factory.th", password: "planner2026" },
};

async function waitForServer(url, attempts = 40) {
  for (let i = 0; i < attempts; i++) {
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (response.status < 500) return;
    } catch {
      // not up yet
    }
    await delay(500);
  }
  throw new Error(`Server did not become ready at ${url}`);
}

/** Read a real id out of the running app so detail pages are never hard-coded. */
async function firstId(page, path, pattern) {
  await page.goto(`${BASE_URL}${path}`, { waitUntil: "networkidle" });
  const href = await page.locator(`a[href*="${pattern}"]`).first().getAttribute("href");
  if (!href) throw new Error(`No ${pattern} link found on ${path}`);
  return href;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  await waitForServer(BASE_URL);

  const browser = await chromium.launch();
  const written = [];

  // The demo session lives in sessionStorage, which is per tab, so each account
  // gets one context holding exactly one page that we keep for the whole run.
  const sessions = {};
  for (const [name, creds] of Object.entries(ACCOUNTS)) {
    const context = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: 2,
      locale: "th-TH",
      timezoneId: "Asia/Bangkok",
    });
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
    await page.fill("#email", creds.email);
    await page.fill("#password", creds.password);
    await page.click('button[type="submit"]');
    await page.waitForURL("**/dashboard", { timeout: 20000 });
    sessions[name] = { context, page };
  }

  // Resolve the dynamic routes once, from the engineer session.
  const engineer = sessions.engineer.page;
  const assetPath = await firstId(engineer, "/assets", "/assets/");
  const workOrderPath = await firstId(engineer, "/work-orders", "/work-orders/");

  for (const shot of SHOTS) {
    let context;
    let page;
    let owned = false;

    if (shot.account) {
      ({ context, page } = sessions[shot.account]);
    } else {
      context = await browser.newContext({ viewport: VIEWPORT, locale: "th-TH" });
      page = await context.newPage();
      owned = true;
    }

    await page.setViewportSize(shot.mobile ? { width: 390, height: 844 } : VIEWPORT);
    await page.emulateMedia({ colorScheme: shot.dark ? "dark" : "light" });

    let target = shot.path;
    if (target === "FIRST_ASSET") target = assetPath;
    if (target === "FIRST_WORK_ORDER") target = workOrderPath;

    await page.goto(`${BASE_URL}${target}`, { waitUntil: "networkidle" });
    // Let Recharts finish its entry animation before capturing.
    await page.waitForTimeout(1200);

    const file = `${OUT_DIR}/${shot.file}`;
    await page.screenshot({ path: file, fullPage: true });
    written.push(file);
    console.log(`captured ${file}`);

    if (owned) await context.close();
  }

  await browser.close();
  console.log(`\n${written.length} screenshots written to ${OUT_DIR}/`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
