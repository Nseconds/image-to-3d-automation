const express = require('express');
const multer = require('multer');
const puppeteer = require('puppeteer');
const fs = require('fs');
const os = require('os');
const path = require('path');

const app = express();
const upload = multer({ dest: os.tmpdir() });

const SERVICE_API_KEY = process.env.SERVICE_API_KEY; // set this in Render env vars
const TARGET_URL = 'https://image-to-3d.ai/?ref=riseofmachine.com#playground';
const NAV_TIMEOUT = 45000;
const CONVERT_TIMEOUT = 180000; // generation can be slow — adjust as needed

function requireApiKey(req, res, next) {
  if (!SERVICE_API_KEY) return next(); // no key configured = open (fine for local testing only)
  const provided = req.header('x-api-key');
  if (provided !== SERVICE_API_KEY) return res.status(401).json({ error: 'Invalid or missing x-api-key header' });
  next();
}

app.get('/health', (req, res) => res.json({ ok: true }));

app.post('/convert', requireApiKey, upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Missing "image" file in multipart form-data' });

  let browser;
  const downloadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'glb-'));

  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    const page = await browser.newPage();
    const client = await page.createCDPSession();
    await client.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: downloadDir });

    await page.goto(TARGET_URL, { waitUntil: 'networkidle2', timeout: NAV_TIMEOUT });

    // --- STEP 1: locate the file upload input -----------------------------
    // TODO-VERIFY: image-to-3d.ai's playground markup was not fully inspectable
    // via static fetch (it's likely rendered client-side). Run this service
    // locally with `headless: false` once, open devtools, and confirm/adjust
    // the selector below against the live DOM before trusting production runs.
    const fileInputSelector = 'input[type="file"]';
    await page.waitForSelector(fileInputSelector, { timeout: NAV_TIMEOUT });
    const fileInput = await page.$(fileInputSelector);
    await fileInput.uploadFile(req.file.path);

    // --- STEP 2: trigger conversion ----------------------------------------
    // TODO-VERIFY: adjust the button text below to match the live page
    // ("Convert", "Generate 3D", "Generate Model", etc.)
    const clicked = await page.evaluate(() => {
      const candidates = Array.from(document.querySelectorAll('button, a'));
      const btn = candidates.find(el => /convert|generate/i.test(el.textContent || ''));
      if (btn) { btn.click(); return true; }
      return false;
    });
    if (!clicked) throw new Error('Could not find a Convert/Generate button — selector needs updating, see TODO-VERIFY comments in server.js');

    // --- STEP 3: wait for a downloadable/exportable result ------------------
    // TODO-VERIFY: adjust the button text below to match the live export/download control
    await page.waitForFunction(() => {
      const candidates = Array.from(document.querySelectorAll('button, a'));
      return candidates.some(el => /download|export|glb/i.test(el.textContent || ''));
    }, { timeout: CONVERT_TIMEOUT });

    await page.evaluate(() => {
      const candidates = Array.from(document.querySelectorAll('button, a'));
      const btn = candidates.find(el => /download|export|glb/i.test(el.textContent || ''));
      if (btn) btn.click();
    });

    // --- STEP 4: wait for the .glb to land in the download directory --------
    const glbPath = await waitForDownload(downloadDir, 60000);

    res.setHeader('Content-Type', 'model/gltf-binary');
    res.setHeader('Content-Disposition', 'attachment; filename="asset.glb"');
    fs.createReadStream(glbPath).pipe(res);
  } catch (err) {
    console.error('[convert] failed:', err);
    res.status(502).json({ error: err.message });
  } finally {
    if (browser) await browser.close().catch(() => {});
    fs.rm(downloadDir, { recursive: true, force: true }, () => {});
    fs.unlink(req.file.path, () => {});
  }
});

function waitForDownload(dir, timeoutMs) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      const files = fs.readdirSync(dir).filter(f => !f.endsWith('.crdownload'));
      const glb = files.find(f => f.toLowerCase().endsWith('.glb') || f.toLowerCase().endsWith('.gltf'));
      if (glb) return resolve(path.join(dir, glb));
      if (Date.now() - start > timeoutMs) return reject(new Error('Timed out waiting for downloaded model file'));
      setTimeout(check, 1000);
    };
    check();
  });
}

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`image-to-3d automation service listening on :${PORT}`));
