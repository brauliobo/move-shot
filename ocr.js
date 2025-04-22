import ollama from 'ollama';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// --- Global Timeout Configuration ---
const TIMEOUT_MINUTES = 30;
const TIMEOUT_MS = TIMEOUT_MINUTES * 60 * 1000; // Convert to milliseconds

// Set undici HTTP client timeout via NODE_OPTIONS
// This needs to be done before any HTTP requests are made
if (!process.env.NODE_OPTIONS || !process.env.NODE_OPTIONS.includes('--http-parser-timeout')) {
  process.env.NODE_OPTIONS = `${process.env.NODE_OPTIONS || ''} --http-parser-timeout=${TIMEOUT_MS}`;
  console.log(`Set undici HTTP parser timeout to ${TIMEOUT_MINUTES} minutes`);
}

// --- Configuration & Helpers ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const screenshotsDir = path.join(__dirname, 'screenshots');
const markdownOutputFile = path.join(__dirname, 'ocr.md'); // Renamed for clarity
const defaultOllamaModel = process.env.OLLAMA_MODEL || 'gemma3:12b-it-qat';
const transcriptionPrompt = `Extract and transcribe *only* the main textual content of the book page shown in this image. Preserve formatting like paragraphs where possible.

IGNORE all of the following elements:
- Headers with book title, chapter name, or author names
- Footers with page numbers or location indicators
- Kindle progress indicators (percentage, time left)
- Navigation bars or buttons
- Kindle menu items or icons
- Any location markers like "Location 123-456"
- Chapter or section numbering not part of the actual text
- Any UI elements overlaid on the text

Provide only the clean transcribed text content, exactly as it appears on the page. Do not add any descriptions or commentary about the image itself.`;
// Use the same global timeout
const ollamaTimeoutMs = TIMEOUT_MS;

const numericalSort = (a, b) => {
    const numA = parseInt(a.match(/^(\d+)/)?.[1] || '0', 10);
    const numB = parseInt(b.match(/^(\d+)/)?.[1] || '0', 10);
    return numA - numB;
};

// --- Reusable Functions (Exported) ---

/**
 * Reads the screenshots directory, filters for PNGs, and returns a sorted list.
 * @returns {Promise<string[]>} A promise resolving to an array of sorted PNG filenames.
 * @throws {Error} If the directory cannot be read or no PNGs are found.
 */
export async function getScreenshotFiles() {
    try {
        const allFiles = await fs.readdir(screenshotsDir);
        const screenshotFiles = allFiles
            .filter(file => file.toLowerCase().endsWith('.png'))
            .sort(numericalSort);

        if (screenshotFiles.length === 0) {
            throw new Error('No .png files found in the screenshots directory.');
        }
        console.log(`Found ${screenshotFiles.length} screenshot file(s).`);
        return screenshotFiles;
    } catch (error) {
        if (error.code === 'ENOENT') {
            throw new Error(`Screenshots directory not found at ${screenshotsDir}`);
        } else {
            console.error('Error reading screenshots directory:', error);
            throw error; // Re-throw after logging
        }
    }
}

/**
 * Performs OCR on a single image file using Ollama.
 * @param {string} imageFilename - The filename of the image within the screenshots directory.
 * @param {string} [model] - The Ollama model to use (defaults to environment variable or 'gemma3:12b-it-qat').
 * @returns {Promise<string|null>} A promise resolving to the transcribed text, or null if OCR fails or returns no content.
 */
export async function performOcrOnImage(imageFilename, model = defaultOllamaModel) {
    const fullImagePath = path.join(screenshotsDir, imageFilename);
    console.log(`  - OCR for ${imageFilename} using ${model}...`);
    try {
        const imageBuffer = await fs.readFile(fullImagePath);
        const imageBase64 = imageBuffer.toString('base64');

        const response = await ollama.chat({
            model: model,
            messages: [{
                role: 'user',
                content: transcriptionPrompt,
                images: [imageBase64]
            }],
            options: {
                timeout: ollamaTimeoutMs
            }
        });

        if (response?.message?.content) {
            let transcribedText = response.message.content.trim();
            // Basic cleanup
            transcribedText = transcribedText.replace(/^```(markdown)?\s*/, '').replace(/```\s*$/, '');
            console.log(`    OCR Success for ${imageFilename}.`);
            return transcribedText;
        } else {
            console.warn(`  - Warning: Received no content from Ollama for ${imageFilename}.`);
            return null;
        }
    } catch (imageError) {
        console.error(`  - Error processing ${imageFilename}:`, imageError.message);
        if (imageError.cause) console.error('    Cause:', imageError.cause);
        return null; // Return null on error
    }
}


// --- Function to Generate Markdown File (for standalone execution) ---
async function generateMarkdownFile() {
    const modelToUse = defaultOllamaModel;
    console.log(`Starting Markdown generation process using model: ${modelToUse}`);
    console.log(`Output file: ${markdownOutputFile}`);
    console.log(`Timeout set to: ${TIMEOUT_MINUTES} minutes`);

    let screenshotFiles;
    try {
        screenshotFiles = await getScreenshotFiles();
    } catch (error) {
        console.error("Error getting screenshot files:", error.message);
        return; // Stop if files can't be listed
    }

    let successfulProcessing = false;
    try {
        await fs.writeFile(markdownOutputFile, `# Transcription Results\n\n`);
        console.log(`Initialized markdown file: ${markdownOutputFile}`);

        for (const filename of screenshotFiles) {
            const transcribedText = await performOcrOnImage(filename); // Use default model
            let outputChunk;

            if (transcribedText !== null) {
                outputChunk = `${transcribedText}\n\n`;
                successfulProcessing = true;
            } else {
                outputChunk = `\n\n[OCR Warning/Error for ${filename}]\n\n`;
            }
            await fs.appendFile(markdownOutputFile, outputChunk);
        }

        console.log(`\nMarkdown generation completed. Results saved to ${markdownOutputFile}`);

        if (successfulProcessing) {
            try {
                const outputContent = await fs.readFile(markdownOutputFile, 'utf-8');
                const lines = outputContent.split('\n');
                const preview = lines.slice(0, 5).join('\n');
                console.log('\n--- Markdown File Preview (first 5 lines) ---');
                console.log(preview);
                console.log('-------------------------------------------');
            } catch (readError) {
                console.error('\nCould not read markdown file for preview:', readError);
            }
        }

    } catch (error) {
        console.error('\nAn error occurred during Markdown generation:', error);
    }
}

// --- Standalone Execution Check ---
// Determine if the script is being run directly
const isMainScript = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);

if (isMainScript) {
    console.log("Running ocr.js as standalone script...");
    generateMarkdownFile();
} else {
    // console.log("ocr.js loaded as a module."); // Optional log
}
