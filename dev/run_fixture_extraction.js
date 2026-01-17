/**
 * Dev Runner - Puppeteer script to test extraction on fixture
 * Usage: node dev/run_fixture_extraction.js
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const FIXTURE_PATH = path.join(__dirname, 'fixture-opportunity.html');
const EXTRACTOR_PATH = path.join(__dirname, '..', 'src', 'content', 'extractors', 'opportunity.js');
const OUTPUT_PATH = path.join(__dirname, 'extracted.json');

async function runExtraction() {
    console.log('🚀 Starting extraction test...\n');

    if (!fs.existsSync(FIXTURE_PATH)) {
        console.error('❌ Fixture not found:', FIXTURE_PATH);
        process.exit(1);
    }

    let browser;

    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        const fixtureUrl = `file:///${FIXTURE_PATH.replace(/\\/g, '/')}`;
        console.log('🌐 Loading:', fixtureUrl);
        await page.goto(fixtureUrl, { waitUntil: 'domcontentloaded' });

        // Inject the extractor code
        const extractorCode = fs.readFileSync(EXTRACTOR_PATH, 'utf8');
        await page.evaluate(extractorCode);

        console.log('⚙️  Running extraction...\n');

        const result = await page.evaluate(async () => {
            try {
                if (typeof window.extractRecordDetail === 'function') {
                    return await window.extractRecordDetail();
                }
                throw new Error('extractRecordDetail not found');
            } catch (err) {
                return { error: err.message, stack: err.stack };
            }
        });

        if (result.error) {
            console.error('❌ Extraction failed:', result.error);
            process.exit(1);
        }

        console.log('✅ Extraction successful!\n');
        console.log(JSON.stringify(result, null, 2));

        fs.writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 2), 'utf8');
        console.log(`\n💾 Output: ${OUTPUT_PATH}`);

    } catch (err) {
        console.error('❌ Error:', err.message);
        process.exit(1);
    } finally {
        if (browser) await browser.close();
    }

    console.log('\n✨ Done!');
}

runExtraction();
