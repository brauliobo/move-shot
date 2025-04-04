# Web Page Screenshot & OCR Suite

This project provides a set of Node.js scripts to automate the process of taking sequential screenshots of web pages, performing OCR on them using local Ollama vision models, and generating either a plain text transcription or a searchable PDF.

It's particularly useful for "scanning" web-based book readers or articles where text selection is disabled or difficult, but has potential for various web archiving and data extraction tasks.

**Core Components:**

*   **`move-shot.js`:** Uses Puppeteer to automatically navigate to a URL, click at a user-defined position (to advance pages, for example), take a full-page screenshot, and repeat indefinitely until stopped. It preserves browser sessions to maintain logins.
*   **`ocr.js`:** Processes the generated screenshots using a local Ollama vision model (like `llama3.2-vision` or `llava`) to transcribe the text. Can run standalone to create a Markdown file or be used as a module.
*   **`pdf.js`:** Imports functionality from `ocr.js` and uses `pdf-lib` to generate a searchable PDF document. Each page displays the original screenshot image with an invisible text layer underneath, making the PDF content searchable and copyable (with some limitations).

## Motivation

Many websites, especially online book readers or archives, present content as images or within canvases that prevent easy text selection and copying. This suite aims to overcome that limitation by:

1.  Automating the tedious process of capturing each page.
2.  Leveraging local, powerful AI vision models via Ollama for high-quality text recognition without external APIs.
3.  Producing accessible and searchable output formats (Markdown text or searchable PDF).

## Features

*   **Automated Screenshotting:** Sequentially clicks and captures full web pages.
*   **Interactive Click Positioning:** Guides the user to select the click coordinates via terminal feedback.
*   **Session Persistence:** Saves browser session data (`./sessions`) to restore logins across runs.
*   **Indefinite Operation:** Runs the screenshot loop continuously until manually stopped (Ctrl+C) for long scanning tasks.
*   **Local OCR:** Uses your own Ollama instance and vision models for privacy and control.
*   **Configurable OCR Model:** Easily switch between Ollama vision models via environment variable.
*   **Markdown Output:** Generates a clean Markdown file (`ocr.md`) with the transcribed text.
*   **Searchable PDF Output:** Creates a PDF (`out.pdf`) with images and corresponding invisible text layers.
*   **Modular Design:** OCR logic is reusable and separated from the PDF generation.
*   **Configurable:** Uses environment variables for setup.

## Requirements

*   **Node.js:** Version 18.x or later recommended (uses ES Modules).
*   **pnpm:** A fast, disk space-efficient package manager. Install via `npm install -g pnpm` or see [pnpm installation guide](https://pnpm.io/installation).
*   **Ollama:** Installed and running locally. See [Ollama Website](https://ollama.com/).
*   **Ollama Vision Model:** At least one vision-capable model downloaded (e.g., `llama3.2-vision`, `llava`).
    *   Run `ollama pull llama3.2-vision` (or `ollama pull llava`, etc.) in your terminal.
*   **(Optional) Git:** For cloning the repository.

## Installation

1.  **Clone the repository (if you haven't already):**
    ```bash
    git clone <your-repository-url>
    cd <repository-directory>
    ```
2.  **Install dependencies using pnpm:**
    ```bash
    pnpm install
    ```
    *(This will create a `pnpm-lock.yaml` file and install packages into a shared store).*
3.  **Ensure `package.json` Type:** This project uses ES Modules. Ensure your `package.json` includes the line `"type": "module"`.

## Configuration (Environment Variables)

These scripts rely on environment variables for configuration. You need to set these **before running** the scripts. How you set them depends on your operating system:

*   **Linux/macOS (Bash/Zsh):** Prefix the `node` command:
    ```bash
    VAR1=value1 VAR2=value2 node script.js
    ```
*   **Windows (Command Prompt):** Use `set` and run the command separately:
    ```cmd
    set VAR1=value1
    set VAR2=value2
    node script.js
    ```
*   **Windows (PowerShell):** Use `$env:`:
    ```powershell
    $env:VAR1="value1"; $env:VAR2="value2"; node script.js
    ```
*   **(Alternative):** You can still optionally use a `.env` file and a tool like `dotenv-cli` (`pnpm add -D dotenv-cli`) if you prefer: `dotenv node script.js`. However, the instructions below assume direct variable setting.

**Required Variables:**

*   `TARGET_URL`: The full URL of the website/page you want to screenshot initially.

**Optional Variables:**

*   `DELAY_MS`: Delay in milliseconds after clicking before taking the screenshot. Defaults to `1000` (1 second). Adjust based on page load time.
*   `OUTPUT_DIR`: Directory where screenshots will be saved (relative to project root). Defaults to `./screenshots`.
*   `SESSION_DIR`: Directory where browser session data will be saved (relative to project root). Defaults to `./sessions`.
*   `OLLAMA_VISION_MODEL`: The Ollama vision model to use for OCR. Defaults to `llama3.2-vision`. Ensure the model is downloaded via `ollama pull <model_name>`.

## Usage

**Important:** Ensure your Ollama application is running *before* starting Step 2.

**Step 1: Taking Screenshots (`move-shot.js`)**

This script automates the clicking and capturing process.

1.  Define the necessary environment variables. At minimum, `TARGET_URL`.
    ```bash
    # Example for Linux/macOS
    export TARGET_URL="https://www.example-book-reader.com/page/1"
    export DELAY_MS=1500 # Optional: Set custom delay
    ```
2.  Run the script:
    ```bash
    node move-shot.js
    # Or if variables were not exported:
    # TARGET_URL="https://..." DELAY_MS=1500 node move-shot.js
    ```
3.  A browser window will open and navigate to `TARGET_URL`.
    *   **First Run / Session Expired:** If needed, manually log in to the website within the opened browser window *now*.
4.  The terminal will prompt you to position your mouse cursor in the browser window over the element you want to click repeatedly (e.g., the "next page" button/area).
5.  Move your mouse to the desired location. The terminal will display the current coordinates.
6.  Once the cursor is positioned correctly, switch focus back to the **terminal** and press `Enter`.
7.  The script will confirm the captured coordinates and begin the loop:
    *   Move mouse to coordinates.
    *   Click.
    *   Wait `DELAY_MS`.
    *   Take screenshot (saved as `1.png`, `2.png`, ... in `OUTPUT_DIR`).
    *   Repeat.
8.  Press `Ctrl+C` in the terminal to gracefully stop the script when you have captured all desired pages. The browser will close automatically.

**Step 2 (Choose one or both):**

Make sure the `./screenshots` directory (or your custom `OUTPUT_DIR`) contains the `.png` files from Step 1 and that your **Ollama service is running**.

**Step 2a: Generate Markdown Transcription (`ocr.js`)**

This creates a single text file containing the transcribed content.

1.  *(Optional)* Set `OLLAMA_VISION_MODEL` if you want to use a model other than the default.
    ```bash
    # Example for Linux/macOS
    export OLLAMA_VISION_MODEL="llava"
    ```
2.  Run the script:
    ```bash
    node ocr.js
    # Or:
    # OLLAMA_VISION_MODEL="llava" node ocr.js
    ```
3.  The script will process each `.png` file using the specified Ollama model.
4.  A file named `ocr.md` will be created/overwritten in the project root containing the transcribed text.

**Step 2b: Generate Searchable PDF (`pdf.js`)**

This creates a PDF file with images and hidden text layers.

1.  *(Optional)* Set `OLLAMA_VISION_MODEL` if you want to use a model other than the default.
    ```bash
    # Example for Linux/macOS
    export OLLAMA_VISION_MODEL="llava"
    ```
2.  Run the script:
    ```bash
    node pdf.js
    # Or:
    # OLLAMA_VISION_MODEL="llava" node pdf.js
    ```
3.  The script will process each `.png` file, perform OCR, and build the PDF.
4.  A file named `out.pdf` will be created/overwritten in the project root. Open this file in a PDF viewer – you should be able to search for text within the images and copy text (though selection highlighting might not be perfectly aligned).

## Potential Use Cases

Beyond the primary use case of scanning web books:

*   **Archiving:** Save web articles, forum threads, or social media content in a searchable format.
*   **Monitoring:** Periodically screenshot web pages and OCR them to track textual changes.
*   **Documentation:** Capture sequences of interactions with web applications for documentation purposes.
*   **Data Extraction:** Extract text from websites that heavily rely on images or canvas elements for content display.
*   **Accessibility:** Convert otherwise inaccessible web content into formats usable by screen readers (via the generated text/PDF).

## Limitations & Caveats

*   **PDF Text Selection Accuracy:** The generated PDF (`out.pdf`) is searchable, but selecting text directly on the image may not precisely highlight the corresponding words. This is because the script currently lacks the coordinate information for each transcribed word (unlike commercial OCR software) and places the entire text block in a hidden layer.
*   **OCR Accuracy:** The quality of the transcription depends heavily on the clarity of the screenshots and the chosen Ollama vision model's capabilities.
*   **Click Reliability:** Clicking based on fixed coordinates can be fragile. If the web page layout changes or the target element moves, the clicks might miss. More robust automation would involve using CSS selectors or XPath (requires script modification).
*   **Anti-Automation:** Some websites employ measures to detect and block automated tools like Puppeteer. The script might fail on such sites.
*   **Resource Usage:** Running Puppeteer (a full browser instance) and Ollama (large AI models) can be resource-intensive (CPU, RAM, GPU if applicable).

## License

[MIT](LICENSE) (Assuming you choose the MIT license - remember to add a `LICENSE` file).
