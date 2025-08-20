async function execute(params) {
    const { 
        includeTables = true, 
        includeImages = false, 
        includeComments = false, 
        maxBlocks = 200,
        waitForLoad = 5000
    } = params;

    const result = {
        document: {},
        content: [],
        tables: [],
        images: [],
        comments: [],
        metadata: {},
        extractedAt: new Date().toISOString()
    };

    try {
        // Wait for document to load
        await waitForLarkDocLoad(waitForLoad);

        // Extract document metadata
        result.document = extractDocumentInfo();
        
        // Extract content blocks
        result.content = await extractContentBlocks(maxBlocks);

        // Extract tables if requested
        if (includeTables) {
            result.tables = extractTables();
        }

        // Extract images if requested
        if (includeImages) {
            result.images = extractImages();
        }

        // Extract comments if requested
        if (includeComments) {
            result.comments = extractComments();
        }

        // Add metadata
        result.metadata = {
            totalBlocks: result.content.length,
            totalTables: result.tables.length,
            totalImages: result.images.length,
            totalComments: result.comments.length,
            wordCount: calculateWordCount(result.content)
        };

        return JSON.stringify(result, null, 2);

    } catch (error) {
        return JSON.stringify({
            error: error.message,
            document: { url: window.location.href },
            extractedAt: new Date().toISOString()
        }, null, 2);
    }
}

async function waitForLarkDocLoad(maxWait) {
    const startTime = Date.now();
    
    console.log('Waiting for Lark Wiki to load...');
    
    while (Date.now() - startTime < maxWait) {
        // Check for wiki-specific content containers
        const wikiContent = document.querySelector('.page-block-content, .text-editor, .ace-line, .zone-container');
        const docTitle = document.querySelector('h1.page-block-content, .page-block-content h1');
        
        if (wikiContent && docTitle) {
            console.log('Wiki content found, waiting for stabilization...');
            await sleep(1000);
            return;
        }
        
        await sleep(300);
    }
    
    console.log('Load timeout reached');
}

function extractDocumentInfo() {
    const doc = {
        url: window.location.href,
        title: extractTitle(),
        id: extractDocumentId(),
        lastModified: extractLastModified(),
        author: extractAuthor()
    };

    return doc;
}

function extractTitle() {
    // Try various title selectors specific to Lark Wiki
    const titleSelectors = [
        'h1.page-block-content .ace-line',  // Main title in wiki
        '.breadcrumb-container-item__value', // Breadcrumb title
        '#ssrHeaderTitle',  // SSR header title
        '.note-title__input',
        'h1',
        '.page-block-content'
    ];
    
    for (const selector of titleSelectors) {
        const element = document.querySelector(selector);
        if (element) {
            const title = element.textContent?.trim();
            if (title && title !== '​' && title.length > 0) {
                console.log(`Found title: "${title}" using selector: ${selector}`);
                return title;
            }
        }
    }
    
    // Fallback to page title
    const pageTitle = document.title;
    return pageTitle || 'Untitled Document';
}

function extractDocumentId() {
    const patterns = [
        /wiki\/([a-zA-Z0-9]+)/,
        /docx\/([a-zA-Z0-9]+)/,
        /\/([a-zA-Z0-9]{17,})/
    ];

    for (const pattern of patterns) {
        const match = window.location.href.match(pattern);
        if (match) return match[1];
    }
    return null;
}

function extractLastModified() {
    const timeSelectors = [
        '.note-title__time',
        '[data-testid="metaTime"]',
        '.doc-info-time-item'
    ];
    
    for (const selector of timeSelectors) {
        const element = document.querySelector(selector);
        if (element) {
            return element.textContent?.trim();
        }
    }
    return null;
}

function extractAuthor() {
    const authorSelectors = [
        '.docs-info-avatar-name-text',
        '.note-avatar',
        '.editor-info'
    ];
    
    for (const selector of authorSelectors) {
        const element = document.querySelector(selector);
        if (element) {
            const author = element.textContent?.trim() || element.getAttribute('title');
            if (author) return author;
        }
    }
    return null;
}

async function extractContentBlocks(maxBlocks) {
    const blocks = [];
    const processedContent = new Set(); // Track content to avoid duplicates
    
    console.log('Extracting content blocks...');
    
    // Look for the main content container
    const contentContainer = document.querySelector('.page-block-children, .root-render-unit-container');
    
    if (!contentContainer) {
        console.log('No content container found');
        return blocks;
    }

    console.log('Content container found:', contentContainer);

    // First, extract the main title
    const titleElement = document.querySelector('h1.page-block-content .ace-line');
    if (titleElement) {
        const titleText = extractBlockText(titleElement);
        if (titleText && !processedContent.has(titleText)) {
            blocks.push({
                index: blocks.length,
                type: 'title',
                content: titleText,
                metadata: {
                    tagName: 'h1',
                    className: 'title',
                    blockType: 'title',
                    blockId: 'title'
                }
            });
            processedContent.add(titleText);
        }
    }

    // Find main content blocks - target only the top-level blocks with data-block-type
    const blockElements = contentContainer.querySelectorAll('.block[data-block-type]:not([data-block-type="page"])');
    
    console.log(`Found ${blockElements.length} content blocks`);
    
    const limit = Math.min(maxBlocks, blockElements.length);
    
    for (let i = 0; i < limit; i++) {
        const block = blockElements[i];
        const blockType = block.getAttribute('data-block-type');
        const blockId = block.getAttribute('data-block-id');
        
        let text = '';
        let actualType = blockType;
        
        // Extract content based on block type
        if (blockType === 'text') {
            // For text blocks, look for the ace-line content
            const aceLine = block.querySelector('.ace-line');
            if (aceLine) {
                text = extractBlockText(aceLine);
                
                // Check if it contains a mention/link
                const mentionLink = aceLine.querySelector('.mention-doc-embed-container');
                if (mentionLink) {
                    actualType = 'mention';
                    // Get the link text and URL
                    const linkElement = mentionLink.querySelector('a');
                    if (linkElement) {
                        const linkText = linkElement.textContent?.trim();
                        const linkUrl = linkElement.href;
                        text = `[${linkText}](${linkUrl})`;
                    }
                }
            }
        }
        
        // Only add if we have content and haven't seen it before
        if (text && text.length > 0 && text !== '​' && !processedContent.has(text)) {
            const blockInfo = {
                index: blocks.length,
                type: actualType,
                content: text,
                metadata: {
                    tagName: block.tagName?.toLowerCase(),
                    className: block.className,
                    blockType: blockType,
                    blockId: blockId
                }
            };
            
            console.log(`Block ${blocks.length}:`, blockInfo);
            blocks.push(blockInfo);
            processedContent.add(text);
        }
    }
    
    console.log(`Extracted ${blocks.length} unique content blocks`);
    return blocks;
}

function extractBlockText(element) {
    // For Lark Wiki, we need to be careful about extracting text
    // Some elements have special Unicode characters that should be filtered
    
    // If it's an ace-line, get direct text content
    if (element.classList.contains('ace-line')) {
        const textSpans = element.querySelectorAll('span[data-string="true"]');
        if (textSpans.length > 0) {
            return Array.from(textSpans)
                .map(span => span.textContent)
                .filter(text => text && text !== '​' && text.trim().length > 0)
                .join(' ')
                .trim();
        }
    }
    
    // For other elements, get text content but filter out special characters
    const text = element.textContent?.trim();
    if (text) {
        // Remove zero-width characters and other invisible Unicode
        return text.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
    }
    
    return '';
}

function getBlockType(element) {
    // Check for data-block-type attribute first
    const blockType = element.getAttribute('data-block-type');
    if (blockType) return blockType;
    
    // Check class names for type hints
    const className = element.className.toLowerCase();
    
    if (className.includes('page-block-content') && element.tagName.toLowerCase() === 'h1') {
        return 'title';
    }
    
    if (className.includes('text-block') || className.includes('text-editor')) {
        return 'paragraph';
    }
    
    if (className.includes('heading')) {
        if (className.includes('1')) return 'heading1';
        if (className.includes('2')) return 'heading2';
        if (className.includes('3')) return 'heading3';
        return 'heading';
    }
    
    if (className.includes('list')) return 'list';
    if (className.includes('table')) return 'table';
    if (className.includes('code')) return 'code';
    if (className.includes('quote') || className.includes('callout')) return 'quote';
    
    // Infer type from element tag
    const tagName = element.tagName?.toLowerCase();
    switch (tagName) {
        case 'h1': return 'heading1';
        case 'h2': return 'heading2';
        case 'h3': return 'heading3';
        case 'h4': return 'heading4';
        case 'h5': return 'heading5';
        case 'h6': return 'heading6';
        case 'p': return 'paragraph';
        case 'ul': return 'bulleted_list';
        case 'ol': return 'numbered_list';
        case 'li': return 'list_item';
        case 'blockquote': return 'quote';
        case 'pre': 
        case 'code': return 'code';
        default: return 'text';
    }
}

function extractTables() {
    const tables = [];
    
    // Look for Lark-specific table structures
    const tableSelectors = [
        'table',
        '.docx-table-block',
        '[data-block-type="table"]',
        '.table-block'
    ];
    
    let tableElements = [];
    for (const selector of tableSelectors) {
        tableElements = document.querySelectorAll(selector);
        if (tableElements.length > 0) break;
    }
    
    console.log(`Found ${tableElements.length} tables`);
    
    tableElements.forEach((table, tableIndex) => {
        const rows = table.querySelectorAll('tr');
        const tableData = {
            index: tableIndex,
            rows: [],
            rowCount: rows.length,
            columnCount: 0
        };
        
        rows.forEach((row, rowIndex) => {
            const cells = row.querySelectorAll('td, th');
            const rowData = {
                index: rowIndex,
                isHeader: row.querySelector('th') !== null || rowIndex === 0,
                cells: Array.from(cells).map(cell => cell.textContent?.trim() || '')
            };
            
            tableData.columnCount = Math.max(tableData.columnCount, cells.length);
            tableData.rows.push(rowData);
        });
        
        if (tableData.rows.length > 0) {
            tables.push(tableData);
        }
    });
    
    return tables;
}

function extractImages() {
    const images = [];
    
    // Look for images in actual content blocks, not UI elements
    const contentArea = document.querySelector('.page-block-children, .editor-container');
    if (!contentArea) return images;
    
    // Only look for images within content blocks
    const imageElements = contentArea.querySelectorAll('img[src]');
    
    imageElements.forEach((img, index) => {
        const src = img.src;
        
        // Skip UI images, avatars, icons by checking URL patterns and context
        if (src && 
            !src.includes('data:image') && 
            !src.includes('avatar') && 
            !src.includes('static-resource') && // Skip Lark's UI resources
            !img.closest('.navigation-bar, .sidebar, .header, .avatar, .icon, .docs-info, .note-avatar')) {
            
            images.push({
                index: images.length,
                src: src,
                alt: img.alt || '',
                width: img.width || img.getAttribute('width'),
                height: img.height || img.getAttribute('height'),
                caption: extractImageCaption(img)
            });
        }
    });
    
    return images;
}

function extractImageCaption(imageElement) {
    const captionSelectors = [
        '.image-caption',
        '.caption',
        'figcaption'
    ];
    
    const parent = imageElement.closest('figure, .image-block, .image-container');
    if (parent) {
        for (const selector of captionSelectors) {
            const caption = parent.querySelector(selector);
            if (caption) {
                return caption.textContent?.trim();
            }
        }
    }
    
    return null;
}

function extractComments() {
    const comments = [];
    
    // Look for Lark-specific comment structures
    const commentSelectors = [
        '.comment-item',
        '.docx-comment',
        '[data-testid*="comment"]'
    ];
    
    let commentElements = [];
    for (const selector of commentSelectors) {
        commentElements = document.querySelectorAll(selector);
        if (commentElements.length > 0) break;
    }
    
    commentElements.forEach((comment, index) => {
        const author = comment.querySelector('.comment-author, .author')?.textContent?.trim();
        const text = comment.querySelector('.comment-text, .content')?.textContent?.trim();
        const timestamp = comment.querySelector('.comment-time, .time')?.textContent?.trim();
        
        if (text) {
            comments.push({
                index: index,
                author: author || 'Unknown',
                text: text,
                timestamp: timestamp || null
            });
        }
    });
    
    return comments;
}

function calculateWordCount(content) {
    return content.reduce((count, block) => {
        if (block.content) {
            return count + block.content.split(/\s+/).filter(word => word.length > 0).length;
        }
        return count;
    }, 0);
}

function sleep(time) {
    return new Promise((resolve) => setTimeout(() => resolve(), time));
}