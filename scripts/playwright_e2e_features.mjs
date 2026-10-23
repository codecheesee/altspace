import { chromium } from '../frontend/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';

async function runE2EFeatureAudit() {
  console.log('🚀 Launching Chromium for End-to-End Feature & UI/UX Audit...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  page.setDefaultTimeout(5000); // Fail fast, max 5s timeout

  const consoleLogs = [];
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
    else consoleLogs.push(msg.text());
  });

  const screenshotDir = path.resolve('scripts/e2e_screenshots');
  if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true });

  const auditReport = {
    featuresTested: [],
    buttonsTested: [],
    scrollingTested: [],
    modalsTested: [],
    uiBugsFound: [],
    featureBugsFound: [],
    categorizationBugs: [],
    consoleErrors: []
  };

  try {
    // 1. Initial Launch & Palette Verification
    console.log('1. Navigating to AltSpace local instance (http://localhost:5173)...');
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    const title = await page.title();
    console.log(`✓ Page Loaded. Title: "${title}"`);
    auditReport.featuresTested.push('Initial Omnibar Load');
    await page.screenshot({ path: path.join(screenshotDir, '01_initial_palette.png') });

    // Verify Search Input auto-focus
    const inputSelector = 'input[type="text"]';
    const isInputFocused = await page.$eval(inputSelector, el => el === document.activeElement);
    console.log(`✓ Search Input Auto-Focused: ${isInputFocused}`);
    if (!isInputFocused) {
      auditReport.uiBugsFound.push('Search input was not automatically focused upon cold launch.');
    }

    // 2. Test Pro / License Modal Button
    console.log('2. Testing Header "Try Pro" button and Pro Modal...');
    const proBtn = await page.$('button[aria-label="Try AltSpace Pro"]');
    if (proBtn) {
      await proBtn.click();
      await page.waitForTimeout(400);
      auditReport.buttonsTested.push('Header Try Pro button');

      const modalHeader = await page.$('button:has-text("Account"), button:has-text("Features")');
      if (modalHeader) {
        console.log(`✓ Pro License Modal Opened successfully.`);
        auditReport.modalsTested.push('Pro Entitlement & License Modal');
        await page.screenshot({ path: path.join(screenshotDir, '02_pro_license_modal.png') });

        // Switch to "Features" tab
        const featuresTab = await page.$('button:has-text("Features")');
        if (featuresTab) {
          await featuresTab.click();
          await page.waitForTimeout(200);
          auditReport.buttonsTested.push('License Modal Features Tab');
        }

        // Switch to "About" tab
        const aboutTab = await page.$('button:has-text("About")');
        if (aboutTab) {
          await aboutTab.click();
          await page.waitForTimeout(200);
          auditReport.buttonsTested.push('License Modal About Tab');
        }

        // Close via Escape
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      } else {
        auditReport.uiBugsFound.push('Pro License Modal did not render expected tab headers.');
      }
    } else {
      console.log('ℹ No Pro header button visible (current user state may be licensed).');
    }

    // 3. Test Action Drawer (Ctrl + K or Menu Button)
    console.log('3. Testing Action Drawer (Ctrl + K) & Noise Filter toggles...');
    const menuBtn = await page.$('button[aria-label="Command Palette Menu"]');
    if (menuBtn) {
      await menuBtn.click();
    } else {
      await page.keyboard.press('Control+k');
    }
    await page.waitForTimeout(500);

    const actionDrawer = await page.$('div:has-text("Search Noise Filter"), div:has-text("Actions"), div:has-text("Action Drawer")');
    if (actionDrawer) {
      console.log('✓ Action Drawer opened successfully.');
      auditReport.featuresTested.push('Action Drawer (Ctrl + K)');
      await page.screenshot({ path: path.join(screenshotDir, '03_action_drawer_noise_filter.png') });

      // Test Noise Filter submenu / toggle if present
      const filterSubmenu = await page.$('button:has-text("File Noise Filters"), button:has-text("Noise Filter")');
      if (filterSubmenu) {
        await filterSubmenu.click();
        await page.waitForTimeout(300);
        auditReport.buttonsTested.push('File Noise Filters Submenu');
      }

      // Test Master Noise Filter Switch
      const filterToggle = await page.$('button[role="switch"]');
      if (filterToggle) {
        await filterToggle.click();
        await page.waitForTimeout(200);
        auditReport.buttonsTested.push('Master Noise Filter Switch');
        await filterToggle.click(); // revert
      }

      // Test scrolling inside Action Drawer
      const scrollable = await page.$('div.overflow-y-auto, div.overflow-auto');
      if (scrollable) {
        await scrollable.evaluate(el => el.scrollTop = 200);
        await page.waitForTimeout(100);
        auditReport.scrollingTested.push('Action Drawer Scrollable Body');
      }

      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }

    // 4. Test Live Search Features & Hero Cards
    console.log('4. Testing Search Results & Domain Renderers...');

    // 4A: Port Killer
    await page.fill(inputSelector, ':3000');
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(screenshotDir, '04_port_killer_card.png') });
    const portContent = await page.textContent('body');
    if (portContent.includes('3000') || portContent.includes('Port')) {
      console.log('✓ Port Inspector card rendered for :3000');
      auditReport.featuresTested.push('Developer Port Inspector (:3000)');
    }

    // 4B: Smart Game Hub
    await page.fill(inputSelector, 'gta 5');
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(screenshotDir, '05_smart_game_hub_card.png') });
    const gameContent = await page.textContent('body');
    if (gameContent.includes('Grand Theft Auto') || gameContent.includes('GTA') || gameContent.includes('Game')) {
      console.log('✓ Smart Game Hub card rendered for "gta 5"');
      auditReport.featuresTested.push('Smart Game Hub (gta 5)');
    }

    // 4C: Calculator
    await page.fill(inputSelector, '15% of 850');
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(screenshotDir, '06_calculator_smart_query.png') });
    const calcContent = await page.textContent('body');
    if (calcContent.includes('127.5')) {
      console.log('✓ Calculator evaluated "15% of 850" -> 127.5');
      auditReport.featuresTested.push('Smart Math Calculation (15% of 850)');
    } else {
      auditReport.featureBugsFound.push('Calculator did not render 127.5 for "15% of 850"');
    }

    // 4D: Developer Transform (JWT)
    await page.fill(inputSelector, 'jwt eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE5OTk5OTk5OTl9.signature');
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(screenshotDir, '07_developer_transform_jwt.png') });
    const jwtContent = await page.textContent('body');
    if (jwtContent.includes('John Doe') || jwtContent.includes('Claims') || jwtContent.includes('JWT Token')) {
      console.log('✓ JWT Inspector decoded token payload');
      auditReport.featuresTested.push('Offline Developer Transform (JWT)');
    }

    // 4E: Windows Settings Search
    await page.fill(inputSelector, 'sound');
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(screenshotDir, '09_windows_settings_search.png') });
    const soundContent = await page.textContent('body');
    if (soundContent.includes('Sound') || soundContent.includes('Volume')) {
      console.log('✓ Windows Settings search found Sound settings');
      auditReport.featuresTested.push('Windows Settings Search (sound)');
    }

    // 5. Test Keyboard Navigation & Scrolling in Results List
    console.log('5. Testing Keyboard Navigation & Result Scroll-into-view...');
    await page.fill(inputSelector, 'c');
    await page.waitForTimeout(300);

    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(50);
    }
    auditReport.buttonsTested.push('Keyboard ArrowDown (x8)');

    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('ArrowUp');
      await page.waitForTimeout(50);
    }
    auditReport.buttonsTested.push('Keyboard ArrowUp (x4)');

    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(200);
    auditReport.scrollingTested.push('Search Results List Mouse Scroll');
    await page.screenshot({ path: path.join(screenshotDir, '10_keyboard_scroll_navigation.png') });

    // 6. Test Update Modal
    console.log('6. Testing Update Modal via ":update"...');
    await page.fill(inputSelector, ':update');
    await page.waitForTimeout(200);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    const updateContent = await page.textContent('body');
    if (updateContent.includes('AltSpace') && (updateContent.includes('Update') || updateContent.includes('Version'))) {
      console.log('✓ Update Modal opened via :update command.');
      auditReport.modalsTested.push('Update Modal (:update command)');
      await page.screenshot({ path: path.join(screenshotDir, '08_update_modal.png') });

      const checkUpdateBtn = await page.$('button:has-text("Check for Updates"), button:has-text("Refresh")');
      if (checkUpdateBtn) {
        await checkUpdateBtn.click();
        await page.waitForTimeout(400);
        auditReport.buttonsTested.push('Update Modal Check for Updates button');
      }

      await page.keyboard.press('Escape');
    }

    // 7. Layout Overflow & Contrast Check
    console.log('7. Auditing Layout & Viewport bounds...');
    const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const bodyClientWidth = await page.evaluate(() => document.body.clientWidth);
    if (bodyScrollWidth > bodyClientWidth) {
      auditReport.uiBugsFound.push(`Horizontal overflow: body.scrollWidth (${bodyScrollWidth}px) > clientWidth (${bodyClientWidth}px)`);
    } else {
      console.log('✓ Zero horizontal overflow detected (layout is cleanly constrained).');
    }

    auditReport.consoleErrors = consoleErrors;

    console.log('\n===============================================================');
    console.log('            E2E PLAYWRIGHT FEATURE AUDIT SUMMARY               ');
    console.log('===============================================================');
    console.log(`Features Verified: ${auditReport.featuresTested.length}`);
    console.log(`Buttons Exercised: ${auditReport.buttonsTested.length}`);
    console.log(`Scroll Containers: ${auditReport.scrollingTested.length}`);
    console.log(`Modals Tested:     ${auditReport.modalsTested.length}`);
    console.log(`UI/UX Bugs Found:  ${auditReport.uiBugsFound.length}`);
    console.log(`Console Errors:    ${auditReport.consoleErrors.length}`);
    console.log('===============================================================\n');

    fs.writeFileSync('scripts/e2e_audit_report.json', JSON.stringify(auditReport, null, 2));
    return auditReport;

  } catch (err) {
    console.error('Fatal E2E error:', err);
    throw err;
  } finally {
    await browser.close();
  }
}

runE2EFeatureAudit().catch(err => {
  console.error(err);
  process.exit(1);
});
