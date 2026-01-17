const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function generateIcons() {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();

    const sizes = [16, 48, 128];

    for (const size of sizes) {
        const html = `
      <html>
        <body style="margin:0;padding:0;background:transparent;">
          <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
            <defs>
              <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#00b4d8"/>
                <stop offset="100%" style="stop-color:#0077b6"/>
              </linearGradient>
            </defs>
            <rect width="${size}" height="${size}" rx="${size * 0.1875}" fill="url(#grad)"/>
            <text x="${size / 2}" y="${size * 0.7}" text-anchor="middle" font-family="Arial,sans-serif" font-size="${size * 0.5}" font-weight="bold" fill="white">SF</text>
          </svg>
        </body>
      </html>
    `;

        await page.setContent(html);
        await page.setViewport({ width: size, height: size });

        const outputPath = path.join(__dirname, 'icons', `icon${size}.png`);
        await page.screenshot({ path: outputPath, omitBackground: true });
        console.log(`Created: ${outputPath}`);
    }

    await browser.close();
    console.log('Done generating icons!');
}

generateIcons();
