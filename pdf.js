import { PDFDocument, StandardFonts, rgb, PDFRenderingMode } from 'pdf-lib';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Import reusable functions from ocr.js
import { getScreenshotFiles, performOcrOnImage } from './ocr.js';

// --- Configuration ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const screenshotsDir = path.join(__dirname, 'screenshots'); // Needed for full image paths
const pdfOutputFile = path.join(__dirname, 'out.pdf');
const ollamaModelForPdf = process.env.OLLAMA_VISION_MODEL || 'llama3.2-vision'; // Can use same or different model

// --- Main PDF Generation Function ---
async function generateSearchablePdf() {
    console.log(`Starting searchable PDF generation: ${pdfOutputFile}`);
    console.log(`Using OCR model: ${ollamaModelForPdf}`);

    let screenshotFiles;
    try {
        screenshotFiles = await getScreenshotFiles(); // Use the imported function
    } catch (error) {
        console.error("Error getting screenshot files:", error.message);
        return;
    }

    const pdfDoc = await PDFDocument.create();
    // Embed a standard font for the invisible text layer
    const embeddedFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    let pagesAdded = 0;

    console.log('Processing screenshots and adding pages to PDF...');

    for (const filename of screenshotFiles) {
        const fullImagePath = path.join(screenshotsDir, filename);
        console.log(`\nProcessing ${filename} for PDF...`);

        try {
            // 1. Perform OCR
            const ocrText = await performOcrOnImage(filename, ollamaModelForPdf); // Use imported function

            // 2. Read Image Data
            const imageBytes = await fs.readFile(fullImagePath);
            const pdfImage = await pdfDoc.embedPng(imageBytes);
            const imgDims = pdfImage.scale(1.0); // Get dimensions

            // 3. Add Page to PDF
            const page = pdfDoc.addPage([imgDims.width, imgDims.height]);
            pagesAdded++;
            console.log(`  - Added page ${pagesAdded} with dimensions ${imgDims.width}x${imgDims.height}`);

            // 4. Draw Visible Image
            page.drawImage(pdfImage, {
                x: 0,
                y: 0,
                width: imgDims.width,
                height: imgDims.height,
            });
            console.log(`  - Drew visible image for ${filename}`);

            // 5. Draw Invisible Text Layer (if OCR was successful)
            if (ocrText && ocrText.trim().length > 0) {
                page.drawText(ocrText, {
                    x: 5, // Small offset from edge
                    y: 5, // Draw near bottom-left (adjust as needed)
                    font: embeddedFont,
                    size: 6, // Use a small font size for the hidden layer
                    // color: rgb(0, 0, 0), // Color doesn't matter when invisible
                    renderingMode: PDFRenderingMode.Invisible, // Make text invisible
                    // We don't have specific coordinates, so text won't overlay perfectly,
                    // but it will be on the correct page and searchable.
                });
                console.log(`  - Added invisible text layer for ${filename}`);
            } else {
                console.log(`  - Skipping text layer for ${filename} (OCR failed or returned empty).`);
            }

        } catch (error) {
            console.error(`\nError processing ${filename} for PDF:`, error.message);
            console.error("  - This page might be missing or incomplete in the PDF.");
            // Continue to the next file
        }
    } // End loop through files

    if (pagesAdded === 0) {
         console.log("\nNo pages were successfully added to the PDF. Aborting save.");
         return;
    }

    try {
        // 6. Save PDF
        const pdfBytes = await pdfDoc.save();
        await fs.writeFile(pdfOutputFile, pdfBytes);
        console.log(`\nSuccessfully generated searchable PDF: ${pdfOutputFile} with ${pagesAdded} page(s).`);
        console.log("NOTE: Text selection might not perfectly align with visual text due to OCR limitations.");
    } catch(saveError) {
        console.error("\nError saving the final PDF:", saveError);
    }
}

// --- Run the Script ---
generateSearchablePdf();
