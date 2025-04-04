const puppeteer = require('puppeteer');
const readline = require('readline');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// --- Configuration ---
const targetUrl = process.env.TARGET_URL;
// SCREENSHOT_COUNT is no longer used
const delayMs = parseInt(process.env.DELAY_MS, 10) || 1000;
const outputDir = process.env.OUTPUT_DIR || './screenshots';
const sessionDataDir = path.join(__dirname, 'sessions');

// --- Variables to hold captured coordinates ---
let capturedX = 0;
let capturedY = 0;

// --- Control flag for the main loop ---
let keepRunning = true;
let shuttingDown = false; // Prevent multiple SIGINT triggers

// --- Input Validation ---
if (!targetUrl) {
    console.error('Error: TARGET_URL environment variable is not set.');
    process.exit(1);
}
// Removed validation for SCREENSHOT_COUNT
if (isNaN(delayMs) || delayMs < 0) {
    console.error('Error: DELAY_MS must be a non-negative number.');
    process.exit(1);
}


// --- Graceful Shutdown Handler ---
process.on('SIGINT', async () => {
    if (shuttingDown) return; // Already handling shutdown
    shuttingDown = true;
    console.log('\n\nCaught interrupt signal (Ctrl+C). Stopping loop and closing browser...');
    keepRunning = false; // Signal the loop to stop

    // Note: The finally block should handle browser closing,
    // but we set the flag here to break the loop.
    // We might need to add browser.close() here if the finally block
    // doesn't get reached reliably under certain conditions, but let's try without first.
});


// --- Helper function for terminal interaction (askQuestion - unchanged) ---
function askQuestion(query, page) {
    // ... (keep the askQuestion function exactly as it was in the previous working version) ...
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    let latestMousePos = { x: 0, y: 0 };
    let intervalId = null;

    return new Promise((resolve, reject) => {
        const promptText = `${query} (Move mouse in browser, check position below)\nPress ENTER in this terminal to confirm position... `;

        intervalId = setInterval(async () => {
             if (rl.closed) {
                 clearInterval(intervalId);
                 return;
             }
             try {
                 if (page && !page.isClosed()) {
                     latestMousePos = await page.evaluate(() => {
                         const x = typeof window.currentMouseX !== 'undefined' ? window.currentMouseX : 0;
                         const y = typeof window.currentMouseY !== 'undefined' ? window.currentMouseY : 0;
                         return { x, y };
                     });
                     readline.cursorTo(process.stdout, 0);
                     readline.clearLine(process.stdout, 0);
                     process.stdout.write(`${promptText}Current Pos: (${latestMousePos.x}, ${latestMousePos.y}) `);
                 } else {
                     clearInterval(intervalId);
                 }
             } catch (e) {
                 // Ignore intermittent errors unless debugging
                 // console.error('\nError during interval update (ignoring):', e.message);
                 readline.cursorTo(process.stdout, 0);
                 readline.clearLine(process.stdout, 0);
                 process.stdout.write(`${promptText}(Error getting position) `);
             }
         }, 250);

        rl.question(promptText, async () => {
            clearInterval(intervalId);
            rl.close();
            try {
                 if (page && !page.isClosed()) {
                     const finalCoords = await page.evaluate(() => {
                        const x = typeof window.currentMouseX !== 'undefined' ? window.currentMouseX : 0;
                        const y = typeof window.currentMouseY !== 'undefined' ? window.currentMouseY : 0;
                        return { x, y };
                     });
                     console.log(`\nPosition captured: (${finalCoords.x}, ${finalCoords.y})`);
                     resolve(finalCoords);
                 } else {
                    reject(new Error("Browser page closed or context lost before final confirmation."));
                 }

            } catch(evalError) {
                 console.error("\nError evaluating final coordinates:", evalError);
                 reject(evalError);
            }
        });
    });
}


// --- Main Async Function ---
(async () => {
    let browser = null;
    let page = null;

    try {
        // Setup signal handler early
        console.log("Script started. Press Ctrl+C to stop gracefully.");

        // Session directory setup
        if (!fs.existsSync(sessionDataDir)){
            console.log(`Creating session data directory: ${sessionDataDir}`);
            fs.mkdirSync(sessionDataDir, { recursive: true });
        } else {
            console.log(`Using existing session data directory: ${sessionDataDir}`);
        }

        // Launch Browser
        console.log('Launching browser...');
        browser = await puppeteer.launch({
            headless: false,
            defaultViewport: null,
            userDataDir: sessionDataDir
        });

        // Handle disconnected event (optional but good practice)
        browser.on('disconnected', () => {
            console.log('Browser disconnected unexpectedly. Stopping script.');
            keepRunning = false;
            shuttingDown = true; // Prevent SIGINT handler conflicts
        });

        page = await browser.newPage();

        // Inject Mouse Tracking
        await page.evaluateOnNewDocument(() => {
            window.currentMouseX = 0;
            window.currentMouseY = 0;
            document.addEventListener('mousemove', (event) => {
                window.currentMouseX = event.clientX;
                window.currentMouseY = event.clientY;
            }, true);
        });

        // Navigate
        console.log(`Navigating to ${targetUrl}...`);
        await page.goto(targetUrl, { waitUntil: 'networkidle0', timeout: 60000 });
        console.log('Navigation complete.');

        // Capture Coordinates
        console.log('\n>>> Position your mouse cursor over the desired click location <<<');
        console.log('>>> in the browser window. Then press Enter in this terminal. <<<');
        const confirmedCoords = await askQuestion('Mouse Position Check:', page);

        capturedX = confirmedCoords.x;
        capturedY = confirmedCoords.y;
        console.log(`\nUsing coordinates (${capturedX}, ${capturedY}) for clicks.`);

        // Ensure Output Directory
        if (!fs.existsSync(outputDir)){
            console.log(`Creating output directory: ${outputDir}`);
            fs.mkdirSync(outputDir, { recursive: true });
        }

        console.log('Starting infinite screenshot loop... Press Ctrl+C to stop.');

        // --- Infinite Click, Delay, Screenshot Loop ---
        for (let i = 1; keepRunning; i++) { // Loop controlled by keepRunning flag
             // Check flags at the start of the loop
             if (!keepRunning || page.isClosed()) {
                 if(page.isClosed()) console.log(`\nPage closed unexpectedly. Stopping loop.`);
                 break; // Exit loop if flag is false or page closed
             }

            console.log(`\n--- Iteration ${i} ---`);

            console.log(`Moving mouse to (${capturedX}, ${capturedY})...`);
            await page.mouse.move(capturedX, capturedY);

            console.log(`Clicking at (${capturedX}, ${capturedY})...`);
            await new Promise(resolve => setTimeout(resolve, 100)); // Pre-click delay
            await page.mouse.click(capturedX, capturedY);

            console.log(`Waiting for ${delayMs}ms...`);
            await new Promise(resolve => setTimeout(resolve, delayMs)); // Main delay

            const screenshotPath = path.join(outputDir, `${i}.png`);
            console.log(`Taking screenshot: ${screenshotPath}`);

            // Check flags again before potentially long operation
            if (!keepRunning || page.isClosed()) {
                 if(page.isClosed()) console.log('Page closed before screenshot could be taken.');
                 break; // Exit loop
             }

            await page.screenshot({
                 path: screenshotPath,
                 fullPage: true
            });
            console.log('Screenshot saved.');
            // Loop continues if keepRunning is still true
        }

        console.log('\nLoop stopped.'); // Message when loop naturally exits (due to flag)

    } catch (error) {
        // Avoid logging common errors during normal shutdown or browser disconnect
        if (!shuttingDown && !(error.message.includes('Target closed') || error.message.includes('Protocol error') && error.message.includes('disconnected'))) {
            console.error('\nAn error occurred:', error);
            process.exitCode = 1;
        } else if (!shuttingDown) {
            // Log other errors even if shuttingDown flag was set externally (like browser disconnect)
             console.error('\nAn error occurred during shutdown sequence:', error);
             process.exitCode = 1;
        }
    } finally {
        console.log('Entering finally block...');
        if (browser && browser.isConnected()) { // Check if browser is still connected before closing
            console.log('Closing browser (session data preserved)...');
            await browser.close();
            console.log('Browser closed.');
        } else {
            console.log('Browser already closed or disconnected.');
        }
        console.log('Script finished.');
        // Ensure the process exits if it hasn't already (e.g., if SIGINT didn't force exit)
        process.exit(process.exitCode || 0);
    }
})();
