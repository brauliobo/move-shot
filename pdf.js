import pdfLib from 'pdf-lib';
// Destructure TimesRoman instead of Helvetica
const { PDFDocument, StandardFonts, rgb } = pdfLib;

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Import reusable functions from ocr.js
import { getScreenshotFiles, performOcrOnImage } from './ocr.js';

// --- Configuration ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const screenshotsDir = path.join(__dirname, 'screenshots');
const pdfOutputFile = path.join(__dirname, 'out.pdf');
const ollamaModelForPdf = process.env.OLLAMA_VISION_MODEL || 'llama3.2-vision';

// --- Main PDF Generation Function ---
async function generateSearchablePdf() {
    console.log(`Starting searchable PDF generation: ${pdfOutputFile}`);
    console.log(`Using OCR model: ${ollamaModelForPdf}`);

    let screenshotFiles;
    try {
        screenshotFiles = await getScreenshotFiles();
    } catch (error) {
        console.error("Error getting screenshot files:", error.message);
        return;
    }

    const pdfDoc = await PDFDocument.create();
    // ***** CHANGE 1: Use a different standard font *****
    const embeddedFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    let pagesAdded = 0;

    console.log('Processing screenshots and adding pages to PDF incrementally...');

    for (const filename of screenshotFiles) {
        const fullImagePath = path.join(screenshotsDir, filename);
        console.log(`\nProcessing ${filename}...`);

        try {
            const ocrText = await performOcrOnImage(filename, ollamaModelForPdf);
            const imageBytes = await fs.readFile(fullImagePath);
            const pdfImage = await pdfDoc.embedPng(imageBytes);
            const imgDims = pdfImage.scale(1.0);
            const page = pdfDoc.addPage([imgDims.width, imgDims.height]);
            pagesAdded++;
            console.log(`  - Added page ${pagesAdded} (dimensions: ${imgDims.width}x${imgDims.height})`);

            page.drawImage(pdfImage, {
                x: 0,
                y: 0,
                width: imgDims.width,
                height: imgDims.height,
            });

            if (ocrText && ocrText.trim().length > 0) {
                page.drawText(ocrText, {
                    // ***** CHANGE 3: Adjust position slightly *****
                    x: 10, // Slightly away from left edge
                    y: 10, // Slightly away from bottom edge
                    font: embeddedFont,
                    // ***** CHANGE 2: Increase font size slightly *****
                    size: 8,
                    renderingMode: 3, // Keep using integer value for Invisible
                });
            } else {
                console.log(`  - Skipping text layer for ${filename} (OCR failed or returned empty).`);
            }

            // Incremental Save
            const pdfBytes = await pdfDoc.save();
            await fs.writeFile(pdfOutputFile, pdfBytes);
            console.log(`  - Saved intermediate PDF (${pdfOutputFile}) with ${pagesAdded} page(s).`);

        } catch (error) {
            console.error(`\nError processing ${filename} for PDF:`, error.message);
            console.error("  - This page might be missing or incomplete in the PDF.");
        }
    } // End loop

    console.log('\n--------------------------------------------------');
    if (pagesAdded > 0) {
        console.log(`Processing finished. Final PDF saved incrementally to ${pdfOutputFile} with ${pagesAdded} page(s).`);
        console.log("NOTE: Text selection might not perfectly align with visual text due to OCR limitations.");
    } else {
        console.log("Processing finished, but no pages were successfully added to the PDF.");
    }
    console.log('--------------------------------------------------');
}

// --- Run the Script ---
generateSearchablePdf();
