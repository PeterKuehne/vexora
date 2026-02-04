"""
Document Parser Microservice - Docling Integration
RAG V2 Phase 2 - Multi-Format Document Parsing

Supports: PDF, DOCX, PPTX, XLSX, HTML, MD, TXT
Usage: uvicorn parser_service:app --host 0.0.0.0 --port 8002
"""

import os
import io
import time
import base64
import hashlib
import tempfile
from typing import List, Optional, Dict, Any
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import markdown

# Docling imports
try:
    from docling.document_converter import DocumentConverter
    from docling.datamodel.base_models import InputFormat
    from docling.datamodel.pipeline_options import PdfPipelineOptions
    from docling.backend.pypdfium2_backend import PyPdfiumDocumentBackend
    DOCLING_AVAILABLE = True
except ImportError:
    DOCLING_AVAILABLE = False
    print("Warning: Docling not available. Install with: pip install docling")

# Configuration
SUPPORTED_FORMATS = ['pdf', 'docx', 'pptx', 'xlsx', 'html', 'md', 'txt']
MAX_FILE_SIZE = 150 * 1024 * 1024  # 150MB

# Global converter instance
converter: Optional[DocumentConverter] = None


# ============================================
# Pydantic Models
# ============================================

class TableCell(BaseModel):
    content: str
    row: int
    col: int
    rowSpan: int = 1
    colSpan: int = 1
    isHeader: bool = False


class TableStructure(BaseModel):
    rows: int
    cols: int
    headers: List[str]
    cells: List[TableCell]
    markdown: str
    hasHeader: bool


class ImageMetadata(BaseModel):
    src: Optional[str] = None
    alt: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None


class ContentBlock(BaseModel):
    type: str  # paragraph, heading, table, list, code, image, caption, footer, header
    content: str
    pageNumber: Optional[int] = None
    position: int
    headingLevel: Optional[int] = None
    listType: Optional[str] = None
    listItems: Optional[List[str]] = None
    table: Optional[TableStructure] = None
    codeLanguage: Optional[str] = None
    image: Optional[ImageMetadata] = None
    confidence: Optional[float] = None


class DocumentOutlineItem(BaseModel):
    title: str
    level: int
    pageNumber: Optional[int] = None
    position: int
    children: List['DocumentOutlineItem'] = []


class DocumentParseMetadata(BaseModel):
    filename: str
    format: str
    fileSize: int
    pageCount: int
    title: Optional[str] = None
    author: Optional[str] = None
    createdDate: Optional[str] = None
    modifiedDate: Optional[str] = None
    parsingDurationMs: float
    parser: str = "docling"
    parserVersion: Optional[str] = None


class ParsingWarning(BaseModel):
    code: str
    message: str
    pageNumber: Optional[int] = None
    position: Optional[int] = None
    severity: str = "warning"


class ParsedDocument(BaseModel):
    documentId: str
    metadata: DocumentParseMetadata
    blocks: List[ContentBlock]
    fullText: str
    outline: List[DocumentOutlineItem]
    warnings: List[ParsingWarning]
    success: bool


class ParseOptions(BaseModel):
    extractTables: bool = True
    extractImages: bool = False
    enableOCR: bool = False
    maxPages: int = 0  # 0 = all
    language: str = "de"


class ParseRequest(BaseModel):
    fileContent: str  # Base64 encoded
    filename: str
    mimeType: Optional[str] = None
    options: Optional[ParseOptions] = None


class ParseResponse(BaseModel):
    success: bool
    document: Optional[ParsedDocument] = None
    error: Optional[str] = None
    processingTimeMs: float


class HealthResponse(BaseModel):
    status: str
    parser: str
    version: str
    supportedFormats: List[str]
    ready: bool


# ============================================
# Parser Implementation
# ============================================

def get_format_from_filename(filename: str) -> Optional[str]:
    """Detect format from filename extension."""
    ext_map = {
        '.pdf': 'pdf',
        '.docx': 'docx',
        '.pptx': 'pptx',
        '.xlsx': 'xlsx',
        '.html': 'html',
        '.htm': 'html',
        '.md': 'md',
        '.markdown': 'md',
        '.txt': 'txt',
    }
    ext = Path(filename).suffix.lower()
    return ext_map.get(ext)


def generate_document_id(content: bytes, filename: str) -> str:
    """Generate unique document ID from content hash."""
    hasher = hashlib.sha256()
    hasher.update(content)
    hasher.update(filename.encode())
    return f"doc_{int(time.time())}_{hasher.hexdigest()[:12]}"


def parse_markdown_content(content: str, filename: str) -> ParsedDocument:
    """Parse markdown content into structured blocks."""
    start_time = time.time()
    blocks: List[ContentBlock] = []
    position = 0
    warnings: List[ParsingWarning] = []
    outline: List[DocumentOutlineItem] = []

    lines = content.split('\n')
    current_paragraph = []

    for line in lines:
        # Heading detection
        if line.startswith('#'):
            # Flush current paragraph
            if current_paragraph:
                para_text = '\n'.join(current_paragraph).strip()
                if para_text:
                    blocks.append(ContentBlock(
                        type='paragraph',
                        content=para_text,
                        position=position,
                        pageNumber=1
                    ))
                    position += 1
                current_paragraph = []

            # Parse heading
            level = len(line) - len(line.lstrip('#'))
            level = min(level, 6)
            heading_text = line.lstrip('#').strip()

            blocks.append(ContentBlock(
                type='heading',
                content=heading_text,
                position=position,
                headingLevel=level,
                pageNumber=1
            ))

            outline.append(DocumentOutlineItem(
                title=heading_text,
                level=level,
                position=position,
                pageNumber=1
            ))
            position += 1

        # Code block detection
        elif line.startswith('```'):
            # Flush current paragraph
            if current_paragraph:
                para_text = '\n'.join(current_paragraph).strip()
                if para_text:
                    blocks.append(ContentBlock(
                        type='paragraph',
                        content=para_text,
                        position=position,
                        pageNumber=1
                    ))
                    position += 1
                current_paragraph = []

            # Extract language hint
            lang = line[3:].strip() or None
            blocks.append(ContentBlock(
                type='code',
                content='',  # Will be filled when block ends
                position=position,
                codeLanguage=lang,
                pageNumber=1
            ))
            position += 1

        # List detection
        elif line.strip().startswith(('- ', '* ', '+ ')) or (line.strip() and line.strip()[0].isdigit() and '. ' in line[:4]):
            # Flush current paragraph
            if current_paragraph:
                para_text = '\n'.join(current_paragraph).strip()
                if para_text:
                    blocks.append(ContentBlock(
                        type='paragraph',
                        content=para_text,
                        position=position,
                        pageNumber=1
                    ))
                    position += 1
                current_paragraph = []

            list_type = 'ordered' if line.strip()[0].isdigit() else 'unordered'
            item_text = line.strip().lstrip('-*+0123456789. ').strip()

            blocks.append(ContentBlock(
                type='list',
                content=item_text,
                position=position,
                listType=list_type,
                listItems=[item_text],
                pageNumber=1
            ))
            position += 1

        # Regular paragraph content
        elif line.strip():
            current_paragraph.append(line)

        # Empty line - flush paragraph
        else:
            if current_paragraph:
                para_text = '\n'.join(current_paragraph).strip()
                if para_text:
                    blocks.append(ContentBlock(
                        type='paragraph',
                        content=para_text,
                        position=position,
                        pageNumber=1
                    ))
                    position += 1
                current_paragraph = []

    # Flush remaining paragraph
    if current_paragraph:
        para_text = '\n'.join(current_paragraph).strip()
        if para_text:
            blocks.append(ContentBlock(
                type='paragraph',
                content=para_text,
                position=position,
                pageNumber=1
            ))

    duration_ms = (time.time() - start_time) * 1000

    return ParsedDocument(
        documentId=generate_document_id(content.encode(), filename),
        metadata=DocumentParseMetadata(
            filename=filename,
            format='md',
            fileSize=len(content.encode()),
            pageCount=1,
            parsingDurationMs=duration_ms,
            parser='native-md'
        ),
        blocks=blocks,
        fullText=content,
        outline=outline,
        warnings=warnings,
        success=True
    )


def parse_txt_content(content: str, filename: str) -> ParsedDocument:
    """Parse plain text content into paragraphs."""
    start_time = time.time()
    blocks: List[ContentBlock] = []
    position = 0

    # Split into paragraphs by double newlines
    paragraphs = content.split('\n\n')

    for para in paragraphs:
        para_text = para.strip()
        if para_text:
            blocks.append(ContentBlock(
                type='paragraph',
                content=para_text,
                position=position,
                pageNumber=1
            ))
            position += 1

    duration_ms = (time.time() - start_time) * 1000

    return ParsedDocument(
        documentId=generate_document_id(content.encode(), filename),
        metadata=DocumentParseMetadata(
            filename=filename,
            format='txt',
            fileSize=len(content.encode()),
            pageCount=1,
            parsingDurationMs=duration_ms,
            parser='native-txt'
        ),
        blocks=blocks,
        fullText=content,
        outline=[],
        warnings=[],
        success=True
    )


def parse_html_content(content: str, filename: str) -> ParsedDocument:
    """Parse HTML content into structured blocks."""
    start_time = time.time()
    blocks: List[ContentBlock] = []
    position = 0
    warnings: List[ParsingWarning] = []
    outline: List[DocumentOutlineItem] = []

    try:
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(content, 'html.parser')

        # Extract title
        title = None
        title_tag = soup.find('title')
        if title_tag:
            title = title_tag.get_text().strip()

        # Process body content
        body = soup.find('body') or soup

        for element in body.find_all(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'table', 'pre', 'code', 'ul', 'ol']):
            tag_name = element.name.lower()

            # Headings
            if tag_name.startswith('h') and len(tag_name) == 2:
                level = int(tag_name[1])
                text = element.get_text().strip()
                if text:
                    blocks.append(ContentBlock(
                        type='heading',
                        content=text,
                        position=position,
                        headingLevel=level,
                        pageNumber=1
                    ))
                    outline.append(DocumentOutlineItem(
                        title=text,
                        level=level,
                        position=position,
                        pageNumber=1
                    ))
                    position += 1

            # Paragraphs
            elif tag_name == 'p':
                text = element.get_text().strip()
                if text:
                    blocks.append(ContentBlock(
                        type='paragraph',
                        content=text,
                        position=position,
                        pageNumber=1
                    ))
                    position += 1

            # Code blocks
            elif tag_name in ['pre', 'code']:
                text = element.get_text().strip()
                if text:
                    lang = element.get('class', [None])[0] if element.get('class') else None
                    blocks.append(ContentBlock(
                        type='code',
                        content=text,
                        position=position,
                        codeLanguage=lang,
                        pageNumber=1
                    ))
                    position += 1

            # Lists
            elif tag_name in ['ul', 'ol']:
                items = [li.get_text().strip() for li in element.find_all('li', recursive=False)]
                if items:
                    blocks.append(ContentBlock(
                        type='list',
                        content='\n'.join(items),
                        position=position,
                        listType='ordered' if tag_name == 'ol' else 'unordered',
                        listItems=items,
                        pageNumber=1
                    ))
                    position += 1

            # Tables
            elif tag_name == 'table':
                rows = element.find_all('tr')
                if rows:
                    headers: List[str] = []
                    cells: List[TableCell] = []

                    for row_idx, row in enumerate(rows):
                        cols = row.find_all(['th', 'td'])
                        for col_idx, col in enumerate(cols):
                            cell_text = col.get_text().strip()
                            is_header = col.name == 'th' or row_idx == 0

                            if is_header and row_idx == 0:
                                headers.append(cell_text)

                            cells.append(TableCell(
                                content=cell_text,
                                row=row_idx,
                                col=col_idx,
                                isHeader=is_header
                            ))

                    # Generate markdown
                    md_lines = []
                    if headers:
                        md_lines.append('| ' + ' | '.join(headers) + ' |')
                        md_lines.append('| ' + ' | '.join(['---'] * len(headers)) + ' |')

                    for row_idx in range(1 if headers else 0, len(rows)):
                        row_cells = [c.content for c in cells if c.row == row_idx]
                        if row_cells:
                            md_lines.append('| ' + ' | '.join(row_cells) + ' |')

                    table_md = '\n'.join(md_lines)

                    blocks.append(ContentBlock(
                        type='table',
                        content=table_md,
                        position=position,
                        table=TableStructure(
                            rows=len(rows),
                            cols=len(headers) or (len(cells) // len(rows) if rows else 0),
                            headers=headers,
                            cells=cells,
                            markdown=table_md,
                            hasHeader=bool(headers)
                        ),
                        pageNumber=1
                    ))
                    position += 1

        # Get full text
        full_text = soup.get_text(separator='\n').strip()

    except ImportError:
        warnings.append(ParsingWarning(
            code='BEAUTIFULSOUP_MISSING',
            message='BeautifulSoup not installed. Install with: pip install beautifulsoup4',
            severity='error'
        ))
        full_text = content
        title = None

    duration_ms = (time.time() - start_time) * 1000

    return ParsedDocument(
        documentId=generate_document_id(content.encode(), filename),
        metadata=DocumentParseMetadata(
            filename=filename,
            format='html',
            fileSize=len(content.encode()),
            pageCount=1,
            title=title,
            parsingDurationMs=duration_ms,
            parser='native-html'
        ),
        blocks=blocks,
        fullText=full_text,
        outline=outline,
        warnings=warnings,
        success=len(warnings) == 0 or all(w.severity != 'error' for w in warnings)
    )


def parse_with_docling(file_content: bytes, filename: str, options: ParseOptions) -> ParsedDocument:
    """Parse document using Docling."""
    global converter

    if not DOCLING_AVAILABLE or converter is None:
        raise ValueError("Docling converter not available")

    start_time = time.time()
    blocks: List[ContentBlock] = []
    warnings: List[ParsingWarning] = []
    outline: List[DocumentOutlineItem] = []
    position = 0

    # Write to temp file for Docling
    file_ext = Path(filename).suffix.lower()
    with tempfile.NamedTemporaryFile(suffix=file_ext, delete=False) as tmp:
        tmp.write(file_content)
        tmp_path = tmp.name

    try:
        # Convert document
        result = converter.convert(tmp_path)
        doc = result.document

        # Extract metadata
        page_count = len(doc.pages) if hasattr(doc, 'pages') and doc.pages else 1
        title = getattr(doc, 'title', None)

        # Process document elements
        if hasattr(doc, 'texts'):
            for item in doc.texts:
                text = item.text.strip() if hasattr(item, 'text') else str(item).strip()
                if not text:
                    continue

                # Determine block type from Docling's labels
                label = getattr(item, 'label', 'paragraph').lower()
                page_num = getattr(item, 'page_no', 1) if hasattr(item, 'page_no') else 1

                if 'heading' in label or 'title' in label:
                    # Determine heading level from label or default to 2
                    level = 1 if 'title' in label else 2
                    if 'h1' in label: level = 1
                    elif 'h2' in label: level = 2
                    elif 'h3' in label: level = 3
                    elif 'h4' in label: level = 4
                    elif 'h5' in label: level = 5
                    elif 'h6' in label: level = 6

                    blocks.append(ContentBlock(
                        type='heading',
                        content=text,
                        position=position,
                        headingLevel=level,
                        pageNumber=page_num
                    ))
                    outline.append(DocumentOutlineItem(
                        title=text,
                        level=level,
                        position=position,
                        pageNumber=page_num
                    ))

                elif 'list' in label:
                    blocks.append(ContentBlock(
                        type='list',
                        content=text,
                        position=position,
                        listType='unordered',
                        listItems=[text],
                        pageNumber=page_num
                    ))

                elif 'code' in label:
                    blocks.append(ContentBlock(
                        type='code',
                        content=text,
                        position=position,
                        pageNumber=page_num
                    ))

                elif 'caption' in label:
                    blocks.append(ContentBlock(
                        type='caption',
                        content=text,
                        position=position,
                        pageNumber=page_num
                    ))

                elif 'footer' in label:
                    blocks.append(ContentBlock(
                        type='footer',
                        content=text,
                        position=position,
                        pageNumber=page_num
                    ))

                elif 'header' in label:
                    blocks.append(ContentBlock(
                        type='header',
                        content=text,
                        position=position,
                        pageNumber=page_num
                    ))

                else:
                    # Default to paragraph
                    blocks.append(ContentBlock(
                        type='paragraph',
                        content=text,
                        position=position,
                        pageNumber=page_num
                    ))

                position += 1

        # Process tables if enabled
        if options.extractTables and hasattr(doc, 'tables'):
            for table_idx, table in enumerate(doc.tables):
                try:
                    # Get table data
                    table_data = table.export_to_dataframe() if hasattr(table, 'export_to_dataframe') else None

                    if table_data is not None:
                        headers = list(table_data.columns)
                        cells: List[TableCell] = []

                        # Header row
                        for col_idx, header in enumerate(headers):
                            cells.append(TableCell(
                                content=str(header),
                                row=0,
                                col=col_idx,
                                isHeader=True
                            ))

                        # Data rows
                        for row_idx, row in table_data.iterrows():
                            for col_idx, value in enumerate(row):
                                cells.append(TableCell(
                                    content=str(value),
                                    row=int(row_idx) + 1,
                                    col=col_idx,
                                    isHeader=False
                                ))

                        # Generate markdown
                        md_lines = ['| ' + ' | '.join(str(h) for h in headers) + ' |']
                        md_lines.append('| ' + ' | '.join(['---'] * len(headers)) + ' |')
                        for _, row in table_data.iterrows():
                            md_lines.append('| ' + ' | '.join(str(v) for v in row) + ' |')
                        table_md = '\n'.join(md_lines)

                        blocks.append(ContentBlock(
                            type='table',
                            content=table_md,
                            position=position,
                            table=TableStructure(
                                rows=len(table_data) + 1,
                                cols=len(headers),
                                headers=[str(h) for h in headers],
                                cells=cells,
                                markdown=table_md,
                                hasHeader=True
                            ),
                            pageNumber=getattr(table, 'page_no', 1) if hasattr(table, 'page_no') else 1
                        ))
                        position += 1

                except Exception as e:
                    warnings.append(ParsingWarning(
                        code='TABLE_EXTRACTION_FAILED',
                        message=f'Failed to extract table {table_idx}: {str(e)}',
                        severity='warning'
                    ))

        # Get full text
        full_text = doc.export_to_markdown() if hasattr(doc, 'export_to_markdown') else '\n'.join(b.content for b in blocks)

        # Detect format
        format_map = {
            '.pdf': 'pdf',
            '.docx': 'docx',
            '.pptx': 'pptx',
            '.xlsx': 'xlsx',
        }
        detected_format = format_map.get(file_ext, 'pdf')

    finally:
        # Cleanup temp file
        try:
            os.unlink(tmp_path)
        except:
            pass

    duration_ms = (time.time() - start_time) * 1000

    return ParsedDocument(
        documentId=generate_document_id(file_content, filename),
        metadata=DocumentParseMetadata(
            filename=filename,
            format=detected_format,
            fileSize=len(file_content),
            pageCount=page_count,
            title=title,
            parsingDurationMs=duration_ms,
            parser='docling',
            parserVersion=getattr(converter, '__version__', '1.0.0') if converter else '1.0.0'
        ),
        blocks=blocks,
        fullText=full_text,
        outline=outline,
        warnings=warnings,
        success=True
    )


# ============================================
# FastAPI App
# ============================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load Docling on startup."""
    global converter

    if DOCLING_AVAILABLE:
        print("Loading Docling document converter...")
        start = time.time()
        try:
            # Configure pipeline options
            pipeline_options = PdfPipelineOptions()
            pipeline_options.do_ocr = False  # OCR can be enabled per-request
            pipeline_options.do_table_structure = True

            converter = DocumentConverter(
                allowed_formats=[
                    InputFormat.PDF,
                    InputFormat.DOCX,
                    InputFormat.PPTX,
                    InputFormat.XLSX,
                    InputFormat.HTML,
                ],
            )
            print(f"Docling loaded in {time.time() - start:.2f}s")
        except Exception as e:
            print(f"Failed to load Docling: {e}")
            converter = None
    else:
        print("Docling not available - using native parsers only")

    yield

    print("Shutting down parser service")


app = FastAPI(
    title="Document Parser Service",
    description="Multi-format document parsing with Docling",
    version="1.0.0",
    lifespan=lifespan
)


@app.get("/health", response_model=HealthResponse)
async def health():
    """Health check endpoint."""
    return HealthResponse(
        status="ok" if (DOCLING_AVAILABLE and converter) or True else "loading",
        parser="docling" if DOCLING_AVAILABLE else "native",
        version="1.0.0",
        supportedFormats=SUPPORTED_FORMATS,
        ready=True  # Native parsers are always ready
    )


@app.post("/parse", response_model=ParseResponse)
async def parse(request: ParseRequest):
    """
    Parse a document and extract structured content.

    Supports PDF, DOCX, PPTX, XLSX, HTML, MD, TXT formats.
    """
    start_time = time.time()

    try:
        # Decode file content
        try:
            file_content = base64.b64decode(request.fileContent)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid base64 content: {str(e)}")

        # Check file size
        if len(file_content) > MAX_FILE_SIZE:
            raise HTTPException(status_code=413, detail=f"File too large. Maximum size: {MAX_FILE_SIZE // (1024*1024)}MB")

        # Detect format
        detected_format = get_format_from_filename(request.filename)
        if not detected_format:
            raise HTTPException(status_code=400, detail=f"Unsupported file format: {request.filename}")

        # Get options
        options = request.options or ParseOptions()

        # Parse based on format
        if detected_format in ['md', 'markdown']:
            content = file_content.decode('utf-8', errors='replace')
            document = parse_markdown_content(content, request.filename)

        elif detected_format == 'txt':
            content = file_content.decode('utf-8', errors='replace')
            document = parse_txt_content(content, request.filename)

        elif detected_format == 'html':
            content = file_content.decode('utf-8', errors='replace')
            document = parse_html_content(content, request.filename)

        elif DOCLING_AVAILABLE and converter:
            # Use Docling for PDF, DOCX, PPTX, XLSX
            document = parse_with_docling(file_content, request.filename, options)

        else:
            # Fallback for binary formats without Docling
            raise HTTPException(
                status_code=503,
                detail=f"Docling not available for {detected_format} parsing. Install docling package."
            )

        processing_time = (time.time() - start_time) * 1000

        return ParseResponse(
            success=document.success,
            document=document,
            processingTimeMs=round(processing_time, 2)
        )

    except HTTPException:
        raise
    except Exception as e:
        processing_time = (time.time() - start_time) * 1000
        return ParseResponse(
            success=False,
            error=str(e),
            processingTimeMs=round(processing_time, 2)
        )


@app.get("/formats")
async def get_formats():
    """List supported formats and their availability."""
    docling_formats = ['pdf', 'docx', 'pptx', 'xlsx'] if DOCLING_AVAILABLE else []
    native_formats = ['html', 'md', 'txt']

    return {
        "supportedFormats": SUPPORTED_FORMATS,
        "doclingFormats": docling_formats,
        "nativeFormats": native_formats,
        "doclingAvailable": DOCLING_AVAILABLE
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
