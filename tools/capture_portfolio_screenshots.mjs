import { chromium } from 'file:///C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const root = 'C:/Users/User/Documents/메이플 환산 파티/boss-cut-lab/output/pdf/screenshots';
const browser = await chromium.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: true,
});

try {
  const page = await browser.newPage({ viewport: { width: 1264, height: 756 }, deviceScaleFactor: 1 });
  await page.goto('https://boss-cut-lab.godnox3.chatgpt.site/', { waitUntil: 'networkidle' });
  await page.getByText('154.8%', { exact: true }).waitFor({ state: 'visible', timeout: 20_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${root}/party-board.png` });

  await page.getByRole('button', { name: '상세 보기', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'visible' });
  await page.screenshot({ path: `${root}/party-validation.png` });

  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '보스 배율', exact: true }).first().click();
  await page.getByRole('heading', { name: '닉네임과 헥사환산으로 보스 효율컷 계산' }).waitFor({ state: 'visible' });
  await page.waitForFunction(() => Array.from(document.images)
    .filter((image) => image.getBoundingClientRect().top < window.innerHeight)
    .every((image) => image.complete && image.naturalWidth > 0));
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${root}/boss-rates.png` });
} finally {
  await browser.close();
}
