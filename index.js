const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/getAppDetails', async (req, res) => {
  const appId = req.query.appId;
  if (!appId) return res.status(400).json({ error: 'Missing appId' });

  const searchUrl = `https://apkpure.com/search?q=${encodeURIComponent(appId)}`;

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 60000 });

    await page.waitForSelector('ul#search-res li a.dd', { timeout: 20000 });
    const appPageUrl = await page.$eval('ul#search-res li a.dd', el => el.href);

    await page.goto(appPageUrl, { waitUntil: 'networkidle2', timeout: 60000 });

    const data = await page.evaluate(() => {
      const getAttr = (selector, attr) =>
        document.querySelector(selector)?.getAttribute(attr) || 'Not found';

      const getText = (selector) =>
        document.querySelector(selector)?.innerText.trim() || 'Not found';

      const fileSizeBytes = getAttr('.normal-download-btn', 'data-dt-file_size');
      const version = getAttr('.normal-download-btn', 'data-dt-version');
      const readableSize = getText('.normal-download-btn strong');

      let downloadSize = 'Not found';
      if (fileSizeBytes && !isNaN(fileSizeBytes)) {
        downloadSize = (parseInt(fileSizeBytes) / (1024 * 1024)).toFixed(1) + ' MB';
      }

      let updatedOn = 'Not found';
      document.querySelectorAll('li .desc').forEach((el) => {
        if (el.innerText.trim().toLowerCase() === 'update date') {
          const head = el.previousElementSibling;
          if (head) updatedOn = head.innerText.trim();
        }
      });

      return { version, downloadSize, readableSize, updatedOn };
    });

    await browser.close();

    res.json({
      appId,
      ...data,
      source: appPageUrl
    });

  } catch (err) {
    console.error('❌ Scraping failed:', err.message);
    if (browser) await browser.close();
    res.status(500).json({ error: 'Scraping failed', details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
