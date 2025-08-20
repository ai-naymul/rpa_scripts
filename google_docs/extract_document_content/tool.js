async function extractContent(maxBlocks, includeFormatting, includeStructure) {
    const content = [];
    
    const contentSelectors = [
        '.kix-appview-editor',
        '[role="textbox"]',
        '.docs-texteventtarget-iframe',
        '.kix-page-paginated' // Add this for SVG content
    ];
    
    let contentContainer = null;
    for (const selector of contentSelectors) {
        contentContainer = document.querySelector(selector);
        if (contentContainer) break;
    }
    
    if (!contentContainer) return content;
    
    // First, try to extract from SVG-based rendering
    const svgContent = extractSVGContent(contentContainer, maxBlocks, includeFormatting, includeStructure);
    if (svgContent.length > 0) {
        return svgContent;
    }
    
    // Fallback to traditional paragraph extraction
    const paragraphSelectors = [
        '.kix-paragraphrenderer',
        '[role="paragraph"]',
        '.kix-lineview-text-block'
    ];
    
    let paragraphs = [];
    for (const selector of paragraphSelectors) {
        paragraphs = contentContainer.querySelectorAll(selector);
        if (paragraphs.length > 0) break;
    }
    
    const limit = Math.min(maxBlocks, paragraphs.length);
    
    for (let i = 0; i < limit; i++) {
        const para = paragraphs[i];
        const textContent = para.textContent.trim();
        
        if (textContent) {
            const block = {
                index: i,
                type: includeStructure ? inferBlockType(para, textContent) : 'paragraph',
                text: textContent
            };
            
            if (includeFormatting) {
                block.formatting = extractFormatting(para);
            }
            
            content.push(block);
        }
    }
    
    // Final fallback to plain text
    if (content.length === 0) {
        const plainText = contentContainer.textContent || '';
        if (plainText.trim()) {
            content.push({
                index: 0,
                type: 'paragraph',
                text: plainText.trim()
            });
        }
    }
    
    return content;
}

function extractSVGContent(container, maxBlocks, includeFormatting, includeStructure) {
    const content = [];
    
    // Look for SVG groups that represent paragraphs
    const paragraphGroups = container.querySelectorAll('g[data-section-type="body"][role="paragraph"]');
    
    if (paragraphGroups.length === 0) {
        return [];
    }
    
    const limit = Math.min(maxBlocks, paragraphGroups.length);
    
    for (let i = 0; i < limit; i++) {
        const group = paragraphGroups[i];
        
        // Extract all text from rect elements within this group
        const textParts = [];
        const rects = group.querySelectorAll('rect[aria-label]');
        
        rects.forEach(rect => {
            const text = rect.getAttribute('aria-label');
            if (text && text.trim()) {
                textParts.push(text.trim());
            }
        });
        
        if (textParts.length > 0) {
            const fullText = textParts.join(' ');
            
            const block = {
                index: i,
                type: includeStructure ? inferBlockTypeFromSVG(group, fullText) : 'paragraph',
                text: fullText
            };
            
            if (includeFormatting) {
                block.formatting = extractSVGFormatting(group);
            }
            
            content.push(block);
        }
    }
    
    return content;
}

function inferBlockTypeFromSVG(group, text) {
    // Check for common heading patterns
    if (text.match(/^(Deployment|Frontend|Backend|Introduction|Conclusion)/i)) {
        return 'heading1';
    }
    
    // Check for list items (lines starting with -, •, numbers, etc.)
    if (text.match(/^\s*[-•*]\s+/) || text.match(/^\s*\d+[\.\)]\s+/)) {
        return 'list_item';
    }
    
    // Check for indented content by looking at transform matrix
    const transform = group.getAttribute('transform');
    if (transform) {
        const match = transform.match(/matrix\([^,]+,[^,]+,[^,]+,[^,]+,(\d+)/);
        if (match) {
            const xOffset = parseInt(match[1]);
            if (xOffset > 120) { // Indented more than typical paragraph
                return 'quote';
            }
        }
    }
    
    return 'paragraph';
}

function extractSVGFormatting(group) {
    const formatting = {
        bold: false,
        italic: false,
        underline: false,
        fontSize: null,
        fontFamily: null,
        color: null
    };
    
    // Extract font information from rect elements
    const rects = group.querySelectorAll('rect[data-font-css]');
    if (rects.length > 0) {
        const fontCss = rects[0].getAttribute('data-font-css');
        if (fontCss) {
            // Parse font CSS string like "400 14.6667px "Arial""
            const fontMatch = fontCss.match(/(\d+)\s+([\d.]+)px\s+"([^"]+)"/);
            if (fontMatch) {
                const fontWeight = parseInt(fontMatch[1]);
                const fontSize = parseFloat(fontMatch[2]);
                const fontFamily = fontMatch[3];
                
                formatting.bold = fontWeight >= 700;
                formatting.fontSize = fontSize + 'px';
                formatting.fontFamily = fontFamily;
            }
        }
    }
    
    return formatting;
}

// Keep existing helper functions
function inferBlockType(element, text) {
    const style = window.getComputedStyle(element);
    const fontSize = parseFloat(style.fontSize);
    const fontWeight = style.fontWeight;
    
    if (fontSize > 20 || fontWeight === 'bold') return 'heading1';
    if (fontSize > 16) return 'heading2';
    if (fontSize > 14) return 'heading3';
    
    if (element.closest('ul, ol') || text.match(/^[\d\w][\.\)]\s/)) {
        return 'list_item';
    }
    
    const marginLeft = parseFloat(style.marginLeft);
    if (marginLeft > 40) return 'quote';
    
    return 'paragraph';
}

function extractFormatting(element) {
    const style = window.getComputedStyle(element);
    return {
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        fontStyle: style.fontStyle,
        textAlign: style.textAlign,
        color: style.color,
        bold: style.fontWeight === 'bold' || parseInt(style.fontWeight) > 400,
        italic: style.fontStyle === 'italic',
        underline: style.textDecoration.includes('underline')
    };
}