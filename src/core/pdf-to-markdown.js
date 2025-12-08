/**
 * Converts PDF ArrayBuffer content to Markdown.
 * Uses Mozilla's PDF.js library.
 * 
 * @param {ArrayBuffer} pdfData - The raw PDF data.
 * @returns {Promise<string>} The generated Markdown.
 */
async function convertPdfToMarkdown(pdfData) {
    if (!window.pdfjsLib) {
        throw new Error("PDF.js library not loaded.");
    }

    // Set worker source
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('src/assets/vendor/pdf.worker.js');

    try {
        const loadingTask = window.pdfjsLib.getDocument({ data: pdfData });
        const pdf = await loadingTask.promise;
        const totalPages = pdf.numPages;
        let markdown = "";

        for (let i = 1; i <= totalPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();

            // Basic heuristic to reconstruction text
            // We'll iterate items and try to detect structure based on font height (transform[0] usually scales x, transform[3] scales y)
            // But for simplicity, we'll just join strings with newlines for now, or basic spacing.

            let lastY = -1;
            let pageText = "";

            for (const item of textContent.items) {
                // item.transform is [scaleX, skewY, skewX, scaleY, tx, ty]
                // ty (transform[5]) is the y coordinate (from bottom usually)

                const y = item.transform[5];
                const text = item.str;

                // If y changes significantly, it's a new line
                if (lastY !== -1 && Math.abs(y - lastY) > 5) {
                    pageText += "\n";
                } else if (lastY !== -1) {
                    // Same line, add space
                    pageText += " ";
                }

                // Detect header-ish size?
                // const height = item.transform[3]; 
                // if (height > 20) ...

                pageText += text;
                lastY = y;
            }

            markdown += `## Page ${i}\n\n${pageText}\n\n---\n\n`;
        }

        return markdown;

    } catch (error) {
        console.error("PDF to Markdown conversion failed:", error);
        throw error;
    }
}
