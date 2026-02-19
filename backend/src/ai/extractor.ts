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

// ─── Main Entry Point ─────────────────────────────────────────

/**
 * Extract raw text from a contract file (PDF or DOCX).
 * For PDFs: tries digital extraction first, falls back to OCR.
 * For DOCX: extracts XML content directly.
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
        return extractFromDocx(buffer);
    }

    // PDF: try digital first, then OCR fallback
    return extractFromPdf(buffer);
}

// ─── PDF Extraction ──────────────────────────────────────────

async function extractFromPdf(buffer: Buffer): Promise<ExtractionResult> {
    // Try digital PDF extraction
    try {
        const result = await extractPdfDigital(buffer);
        if (result.wordCount >= MIN_WORD_COUNT) {
            log.info({ pageCount: result.pageCount, wordCount: result.wordCount }, 'Digital PDF extraction successful');
            return result;
        }
        log.warn(
            { wordCount: result.wordCount },
            `Digital extraction yielded too few words (${result.wordCount}), falling back to OCR`,
        );
    } catch (err) {
        log.warn({ err }, 'Digital PDF extraction failed, falling back to OCR');
    }

    // OCR fallback for scanned PDFs
    return extractPdfOcr(buffer);
}

async function extractPdfDigital(buffer: Buffer): Promise<ExtractionResult> {
    // Dynamic import to avoid loading pdf-parse at startup
    const pdfParse = await import('pdf-parse').then((m) => m.default ?? m);

    const data = await pdfParse(buffer, {
        // Preserve page breaks so we can track page numbers
        pagerender: (pageData: { getTextContent: () => Promise<{ items: Array<{ str: string }> }> }) => {
            return pageData.getTextContent().then((textContent: { items: Array<{ str: string }> }) => {
                return textContent.items.map((item: { str: string }) => item.str).join(' ') + '\n\n[PAGE_BREAK]\n\n';
            });
        },
    });

    const text = cleanText(data.text);
    return {
        text,
        pageCount: data.numpages,
        method: 'digital',
        wordCount: countWords(text),
    };
}

async function extractPdfOcr(buffer: Buffer): Promise<ExtractionResult> {
    log.info('Starting OCR extraction with Tesseract.js');

    const { createWorker } = await import('tesseract.js');
    const worker = await createWorker('eng', 1, {
        logger: (m) => {
            if (m.status === 'recognizing text') {
                log.debug({ progress: Math.round(m.progress * 100) }, 'OCR progress');
            }
        },
    });

    try {
        // OCR the PDF buffer directly (Tesseract handles PDF-to-image internally for PNGs,
        // but for PDFs we pass the buffer directly)
        const { data: { text } } = await worker.recognize(buffer);
        const cleaned = cleanText(text);

        log.info({ wordCount: countWords(cleaned) }, 'OCR extraction complete');

        return {
            text: cleaned,
            pageCount: 1, // Tesseract doesn't give us page count for raw buffer
            method: 'ocr',
            wordCount: countWords(cleaned),
        };
    } finally {
        await worker.terminate();
    }
}

// ─── DOCX Extraction ─────────────────────────────────────────

async function extractFromDocx(buffer: Buffer): Promise<ExtractionResult> {
    log.info({ size: buffer.length }, 'Extracting text from DOCX');

    // DOCX is a ZIP — extract word/document.xml and parse paragraph text
    const JSZip = await import('jszip').then((m) => m.default ?? m).catch(() => null);

    if (!JSZip) {
        throw new Error('jszip is required for DOCX extraction. Run: bun add jszip');
    }

    const zip = await JSZip.loadAsync(buffer);
    const documentXml = zip.file('word/document.xml');

    if (!documentXml) {
        throw new Error('Invalid DOCX file: word/document.xml not found');
    }

    const xmlContent = await documentXml.async('string');

    // Extract text from <w:t> elements (Word text runs)
    const textMatches = xmlContent.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) ?? [];
    const rawText = textMatches
        .map((match) => match.replace(/<[^>]+>/g, ''))
        .join(' ');

    // Extract paragraph breaks from <w:p> elements
    const paragraphText = xmlContent
        .replace(/<w:p[ >]/g, '\n')
        .replace(/<w:t[^>]*>([^<]*)<\/w:t>/g, '$1')
        .replace(/<[^>]+>/g, '')
        .trim();

    const text = cleanText(paragraphText || rawText);

    log.info({ wordCount: countWords(text) }, 'DOCX extraction complete');

    return {
        text,
        pageCount: 1, // DOCX page count not easily determinable without rendering
        method: 'digital',
        wordCount: countWords(text),
    };
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
