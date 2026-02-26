import { createLogger } from '../lib/logger.js';

const log = createLogger('ai.extractor');

// ─── Types ───────────────────────────────────────────────────

export interface ExtractionResult {
    text: string;
    pageCount: number;
    method: 'digital' | 'ocr';
    wordCount: number;
}

// Minimum word count before we consider extraction successful
const MIN_WORD_COUNT = 50;

// Hard timeout for any extraction attempt (ms)
const EXTRACTION_TIMEOUT_MS = 60_000; // 60s max for entire extraction

// ─── Main Entry Point ─────────────────────────────────────────

/**
 * Extract raw text from a contract file (PDF or DOCX).
 * For PDFs: tries digital extraction first, falls back to binary text recovery.
 * For DOCX: extracts XML content directly.
 * All paths are wrapped with hard timeouts (setTimeout-based, not AbortSignal).
 *
 * @param buffer   - Raw file buffer
 * @param fileType - 'pdf' or 'docx'
 */
export async function extractText(
    buffer: Buffer,
    fileType: 'pdf' | 'docx',
): Promise<ExtractionResult> {
    log.info({ fileType, size: buffer.length }, 'Starting text extraction');

    if (fileType === 'docx') {
        return withTimeout(extractFromDocx(buffer), EXTRACTION_TIMEOUT_MS, 'DOCX extraction');
    }

    return withTimeout(extractFromPdf(buffer), EXTRACTION_TIMEOUT_MS, 'PDF extraction');
}

// ─── PDF Extraction ──────────────────────────────────────────

async function extractFromPdf(buffer: Buffer): Promise<ExtractionResult> {
    // Try digital PDF extraction with its own sub-timeout
    try {
        const result = await withTimeout(
            extractPdfDigital(buffer),
            30_000,
            'Digital PDF extraction',
        );

        if (result.wordCount >= MIN_WORD_COUNT) {
            log.info(
                { pageCount: result.pageCount, wordCount: result.wordCount },
                'Digital PDF extraction successful',
            );
            return result;
        }

        log.warn(
            { wordCount: result.wordCount },
            `Digital extraction yielded too few words (${result.wordCount}), falling back to binary text recovery`,
        );
    } catch (err) {
        log.warn({ err }, 'Digital PDF extraction failed or timed out, falling back to binary text recovery');
    }

    // Binary text recovery fallback — much safer than Tesseract OCR on raw PDF buffers
    return withTimeout(extractPdfBinaryRecovery(buffer), 10_000, 'Binary PDF text recovery');
}

async function extractPdfDigital(buffer: Buffer): Promise<ExtractionResult> {
    // pdf-parse does NOT support custom pagerender reliably — use default parsing.
    // The custom pagerender callback was causing hangs on complex PDFs.
    const pdfParse = await import('pdf-parse').then((m) => m.default ?? m);

    const data = await pdfParse(buffer);

    const text = cleanText(data.text);
    return {
        text,
        pageCount: data.numpages,
        method: 'digital',
        wordCount: countWords(text),
    };
}

/**
 * Binary text recovery fallback for PDFs that pdf-parse fails to handle.
 *
 * Tesseract.js v5 `recognize()` expects image formats (PNG/JPEG/BMP), NOT raw
 * PDF buffers. Passing a PDF binary causes it to hang indefinitely. Rather than
 * pulling in pdf2pic + sharp for PDF→image conversion, we extract text fragments
 * directly from the PDF binary stream. This works for most digital PDFs that
 * pdf-parse chokes on (complex fonts, partial encryption, etc).
 */
async function extractPdfBinaryRecovery(buffer: Buffer): Promise<ExtractionResult> {
    log.info('Attempting binary text recovery from PDF stream');

    const rawStr = buffer.toString('latin1');
    // PDF text streams store text in parenthesized strings: (text here)
    const textMatches = rawStr.match(/\(([^\)]{2,200})\)/g) ?? [];
    const recovered = textMatches
        .map((m) => m.slice(1, -1))
        .filter((s) => /[a-zA-Z]{3,}/.test(s)) // Only keep strings with actual words
        .join(' ');

    const text = cleanText(recovered);
    const wordCount = countWords(text);

    log.info({ wordCount, recoveredFragments: textMatches.length }, 'Binary PDF text recovery complete');

    // If we recovered nothing, throw so the pipeline marks the contract as errored
    // rather than hanging or silently storing empty text
    if (wordCount < MIN_WORD_COUNT) {
        throw new Error(
            `Could not extract text from PDF. The file may be a scanned image PDF. ` +
            `Word count: ${wordCount}. Please ensure the PDF has a text layer.`,
        );
    }

    return {
        text,
        pageCount: 1,
        method: 'ocr',
        wordCount,
    };
}

// ─── DOCX Extraction ─────────────────────────────────────────

async function extractFromDocx(buffer: Buffer): Promise<ExtractionResult> {
    log.info({ size: buffer.length }, 'Extracting text from DOCX');

    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(buffer);
    const documentXml = zip.file('word/document.xml');

    if (!documentXml) {
        throw new Error('Invalid DOCX file: word/document.xml not found');
    }

    const xmlContent = await documentXml.async('string');

    // Extract paragraph text preserving structure
    const paragraphText = xmlContent
        .replace(/<w:p[ >]/g, '\n')
        .replace(/<w:t[^>]*>([^<]*)<\/w:t>/g, '$1')
        .replace(/<[^>]+>/g, '')
        .trim();

    const text = cleanText(paragraphText);

    log.info({ wordCount: countWords(text) }, 'DOCX extraction complete');

    return {
        text,
        pageCount: 1,
        method: 'digital',
        wordCount: countWords(text),
    };
}

// ─── Timeout Wrapper ──────────────────────────────────────────

/**
 * Wraps a promise with a hard timeout using setTimeout + Promise.race.
 * This is reliable in both Bun and Node — unlike AbortSignal.timeout()
 * which is not fully implemented in Bun < 1.1.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    let timeoutHandle: ReturnType<typeof setTimeout>;

    const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => {
            reject(new Error(`${label} timed out after ${ms}ms`));
        }, ms);
    });

    return Promise.race([
        promise.finally(() => clearTimeout(timeoutHandle)),
        timeoutPromise,
    ]);
}

// ─── Helpers ──────────────────────────────────────────────────

/**
 * Clean extracted text: normalize whitespace, remove control chars.
 */
function cleanText(raw: string): string {
    return raw
        .replace(/\r\n/g, '\n')          // Normalize line endings
        .replace(/\r/g, '\n')
        .replace(/\f/g, '\n')            // Form feeds → newlines
        .replace(/[^\S\n]+/g, ' ')       // Multiple spaces → single space
        .replace(/\n{3,}/g, '\n\n')      // Max 2 consecutive newlines
        .replace(/[^\x09\x0A\x0D\x20-\x7E\u00A0-\uFFFF]/g, '') // Remove non-printable chars
        .trim();
}

function countWords(text: string): number {
    return text.split(/\s+/).filter(Boolean).length;
}
