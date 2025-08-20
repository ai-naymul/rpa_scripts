async function execute(params) {
    const { maxRecords = 100, includeFieldTypes = true, includeFormattedValues = true, waitForLoad = 3000 } = params;

    const result = {
        base: {},
        table: {},
        fields: [],
        records: [],
        metadata: {},
        extractedAt: new Date().toISOString()
    };

    try {
        // Wait for Airtable to load
        await waitForTableLoad(waitForLoad);

        // Extract base and table information
        result.base.url = window.location.href;
        result.table.name = extractTableName();

        // Extract field schema
        result.fields = extractFields(includeFieldTypes);
        
        // Extract records
        result.records = await extractRecords(maxRecords, includeFormattedValues, result.fields);
        
        // Extract metadata
        result.metadata = {
            totalRecords: result.records.length,
            totalFields: result.fields.length,
            viewType: getCurrentViewType(),
            baseId: extractBaseId(),
            tableId: extractTableId()
        };

        return JSON.stringify(result, null, 2);

    } catch (error) {
        return JSON.stringify({
            error: error.message,
            base: { url: window.location.href },
            extractedAt: new Date().toISOString()
        }, null, 2);
    }
}

async function waitForTableLoad(maxWait) {
    const startTime = Date.now();
    
    console.log('Waiting for table to load...');
    
    while (Date.now() - startTime < maxWait) {
        // Check for grid view structure
        const gridView = document.querySelector('.gridView, [class*="gridView"]');
        if (gridView) {
            // Check for actual data
            const hasHeaders = document.querySelectorAll('.cell[data-columnid], [data-testid="gridHeaderCell"]').length > 0;
            const hasRows = document.querySelectorAll('[data-testid="data-row"], .dataRow[data-rowid]').length > 0;
            
            console.log(`Headers found: ${hasHeaders}, Rows found: ${hasRows}`);
            
            if (hasHeaders && hasRows) {
                console.log('Table loaded successfully');
                await sleep(500); // Additional stability wait
                return;
            }
        }
        
        await sleep(200);
    }
    
    console.log('Table load timeout reached');
}

function extractTableName() {
    // Try multiple approaches to get table name
    const selectors = [
        // From tabs
        '.tableTab.activeTab .truncate-pre',
        '.activeTab [class*="truncate"]',
        '.tableTab[class*="active"] span',
        // From breadcrumbs or headers
        '[data-tutorial-selector-id*="tableTab"] .truncate-pre',
        '.table-name',
        '.tableTabLabel.active',
        // Fallback to any active tab
        '.activeTab span:not(:empty)',
        '[class*="active"] .truncate-pre'
    ];
    
    for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent.trim()) {
            return element.textContent.trim();
        }
    }
    
    // Try to extract from URL or other sources
    const urlMatch = window.location.pathname.match(/\/([^\/]+)$/);
    return urlMatch ? urlMatch[1] : 'Unknown Table';
}

function extractFields(includeTypes = true) {
    const fields = [];
    
    console.log('Extracting fields...');
    
    // More comprehensive header selectors
    const headerSelectors = [
        '.headerRow .cell[data-columnid]',
        '[data-testid="gridHeaderCell"]',
        '.cell.header[data-columnid]',
        '.gridHeaderCell[data-columnid]',
        '[class*="header"][data-columnid]',
        'th[data-columnid]',
        '.headerLeftPane .cell[data-columnid]',
        '.headerRightPane .cell[data-columnid]'
    ];
    
    let headers = [];
    for (const selector of headerSelectors) {
        headers = document.querySelectorAll(selector);
        console.log(`Trying selector "${selector}": found ${headers.length} headers`);
        if (headers.length > 0) break;
    }
    
    console.log(`Found ${headers.length} header elements`);
    
    headers.forEach((header, index) => {
        try {
            const fieldName = extractFieldName(header);
            const columnId = header.getAttribute('data-columnid') || 
                            header.getAttribute('data-column-id') || 
                            `field_${index}`;
            
            console.log(`Processing header ${index}: ${fieldName} (${columnId})`);
            
            if (fieldName && fieldName !== '' && !fieldName.includes('▼')) {
                const field = {
                    index: index,
                    name: fieldName,
                    id: columnId
                };
                
                if (includeTypes) {
                    field.type = inferFieldType(header);
                    console.log(`Field type for ${fieldName}: ${field.type}`);
                }
                
                fields.push(field);
            }
        } catch (error) {
            console.log(`Error processing header ${index}: ${error.message}`);
        }
    });
    
    console.log(`Extracted ${fields.length} fields:`, fields.map(f => f.name));
    return fields;
}

function extractFieldName(headerElement) {
    // Multiple ways to extract field name
    const nameSelectors = [
        '.nameAndDescription .truncate-pre',
        '.name .truncate-pre',
        '.contentWrapper .truncate-pre',
        '.truncate-pre',
        '.name',
        '.contentWrapper',
        'span:not([class*="icon"])',
        'div:not([class*="icon"])'
    ];
    
    for (const selector of nameSelectors) {
        const nameEl = headerElement.querySelector(selector);
        if (nameEl && nameEl.textContent.trim()) {
            return nameEl.textContent.trim();
        }
    }
    
    // Fallback to textContent
    return headerElement.textContent.trim().split('\n')[0].trim();
}

function inferFieldType(headerElement) {
    // First check data attributes which are most reliable
    const columnType = headerElement.getAttribute('data-columntype');
    if (columnType) {
        console.log(`Found data-columntype: ${columnType}`);
        return columnType;
    }
    
    // Look for type indicators in icons
    const iconSelectors = [
        'svg use[href*="#"]',
        '.icon use[href*="#"]',
        'use[href*="#"]',
        'svg',
        '[class*="icon"]'
    ];
    
    for (const selector of iconSelectors) {
        const icon = headerElement.querySelector(selector);
        if (icon) {
            const href = icon.getAttribute('href') || '';
            console.log(`Found icon href: ${href}`);
            
            // Safely get className
            const className = (icon.className && typeof icon.className === 'string') ? 
                            icon.className.toLowerCase() : 
                            (icon.classList ? Array.from(icon.classList).join(' ').toLowerCase() : '');
            
            // Map Airtable field types based on href patterns (more specific patterns)
            if (href.includes('#SingleLineText') || href.includes('#Text')) return 'singleLineText';
            if (href.includes('#Number')) return 'number';
            if (href.includes('#Date') || href.includes('#Calendar')) return 'date';
            if (href.includes('#SingleSelect')) return 'select';
            if (href.includes('#MultipleSelect')) return 'multipleSelect';
            if (href.includes('#Checkbox') || href.includes('#CheckBold') || href.includes('#Check')) return 'checkbox';
            if (href.includes('#MultipleAttachment') || href.includes('#Attachment')) return 'attachment';
            if (href.includes('#Url') || href.includes('#Link')) return 'url';
            if (href.includes('#Email')) return 'email';
            if (href.includes('#Phone')) return 'phoneNumber';
            if (href.includes('#Formula')) return 'formula';
            if (href.includes('#Rollup')) return 'rollup';
            if (href.includes('#ForeignKey') || href.includes('#LinkedRecord')) return 'foreignKey';
            if (href.includes('#LongText') || href.includes('#RichText')) return 'longText';
            if (href.includes('#Currency')) return 'currency';
            if (href.includes('#Percent')) return 'percent';
            if (href.includes('#Duration')) return 'duration';
            if (href.includes('#Rating')) return 'rating';
            
            // Check className patterns as fallback
            if (className.includes('text')) return 'singleLineText';
            if (className.includes('number')) return 'number';
            if (className.includes('date')) return 'date';
            if (className.includes('select')) return 'select';
            if (className.includes('checkbox')) return 'checkbox';
            if (className.includes('attachment')) return 'attachment';
            if (className.includes('link') || className.includes('url')) return 'url';
            if (className.includes('email')) return 'email';
            if (className.includes('phone')) return 'phoneNumber';
            if (className.includes('formula')) return 'formula';
            if (className.includes('rollup')) return 'rollup';
            if (className.includes('foreign')) return 'foreignKey';
        }
    }
    
    // Look for visual indicators in the content
    const headerText = headerElement.textContent.toLowerCase();
    if (headerText.includes('date')) return 'date';
    if (headerText.includes('quantity') || headerText.includes('number') || headerText.includes('count')) return 'number';
    if (headerText.includes('photo') || headerText.includes('image') || headerText.includes('attachment')) return 'attachment';
    if (headerText.includes('email')) return 'email';
    if (headerText.includes('phone')) return 'phoneNumber';
    if (headerText.includes('url') || headerText.includes('link')) return 'url';
    
    return 'singleLineText'; // Default fallback
}

async function extractRecords(maxRecords, includeFormatted, fields) {
    const records = [];
    const processedRowIds = new Set(); // Track processed rows to avoid duplicates
    
    // More comprehensive row selectors
    const rowSelectors = [
        '.dataRow[data-rowid]:not(.ghost):not(.template)',
        '[data-testid="data-row"]',
        '[data-rowid]:not(.ghost):not(.template)'
    ];
    
    let rows = [];
    for (const selector of rowSelectors) {
        rows = document.querySelectorAll(selector);
        if (rows.length > 0) break;
    }
    
    console.log(`Found ${rows.length} rows`);
    
    const recordLimit = Math.min(maxRecords, rows.length);
    
    for (let i = 0; i < recordLimit; i++) {
        const row = rows[i];
        const rowId = row.getAttribute('data-rowid') || 
                     row.getAttribute('data-row-id') || 
                     `record_${i}`;
        
        // Skip if we've already processed this row ID
        if (processedRowIds.has(rowId)) {
            console.log(`Skipping duplicate row: ${rowId}`);
            continue;
        }
        processedRowIds.add(rowId);
        
        const record = {
            id: rowId,
            fields: {}
        };
        
        // Extract cells from this row
        const cells = extractCellsFromRow(row, fields, includeFormatted);
        record.fields = cells;
        
        if (Object.keys(record.fields).length > 0) {
            records.push(record);
        }
    }
    
    console.log(`Extracted ${records.length} unique records`);
    return records;
}

function extractCellsFromRow(row, fields, includeFormatted) {
    const cellData = {};
    
    console.log(`Processing row with ID: ${row.getAttribute('data-rowid')}`);
    
    // Get the row ID to find corresponding cells across panes
    const rowId = row.getAttribute('data-rowid');
    
    // Look for cells in both the current row and matching rows in other panes
    const allRows = document.querySelectorAll(`[data-rowid="${rowId}"]`);
    const allCells = [];
    
    allRows.forEach(r => {
        const cells = r.querySelectorAll('.cell[data-columnid], [data-testid*="gridCell"]');
        allCells.push(...cells);
    });
    
    console.log(`Found ${allCells.length} cells for this row`);
    
    allCells.forEach((cell, index) => {
        try {
            const columnId = cell.getAttribute('data-columnid') || cell.getAttribute('data-column-id');
            const columnIndex = parseInt(cell.getAttribute('data-columnindex')) || index;
            
            // Find the field by ID or index
            const field = fields.find(f => f.id === columnId) || fields[columnIndex];
            
            if (field) {
                const fieldType = field.type || 'singleLineText';
                const value = extractCellValue(cell, fieldType, includeFormatted);
                
                if (value !== null && value !== '') {
                    cellData[field.name] = value;
                    console.log(`Extracted ${field.name}: ${JSON.stringify(value).substring(0, 100)}`);
                }
            } else {
                console.log(`No field found for columnId: ${columnId}, index: ${columnIndex}`);
            }
        } catch (error) {
            console.log(`Error processing cell ${index}: ${error.message}`);
        }
    });
    
    return cellData;
}

function extractCellValue(cell, fieldType, includeFormatted) {
    const cellText = cell.textContent.trim();
    
    // Enhanced cell value extraction based on field type
    switch (fieldType) {
        case 'checkbox':
            // Look for checked indicators
            const checkElements = cell.querySelectorAll('svg use[href*="Check"], .checkbox, [aria-checked]');
            if (checkElements.length > 0) {
                return checkElements[0].getAttribute('aria-checked') === 'true' || 
                       checkElements[0].closest('.checkbox') !== null ||
                       cellText.includes('✓');
            }
            return cellText.toLowerCase().includes('checked') || cellText === '✓';
            
        case 'number':
            const numberMatch = cellText.match(/[\d,.-]+/);
            const numValue = numberMatch ? parseFloat(numberMatch[0].replace(/,/g, '')) : null;
            return isNaN(numValue) ? null : numValue;
            
        case 'date':
            if (cellText && cellText !== '') {
                // Try to parse various date formats
                const datePatterns = [
                    /\d{1,2}\/\d{1,2}\/\d{4}/,  // MM/DD/YYYY
                    /\d{4}-\d{2}-\d{2}/,        // YYYY-MM-DD
                    /\w+ \d{1,2}, \d{4}/        // Month DD, YYYY
                ];
                
                for (const pattern of datePatterns) {
                    const match = cellText.match(pattern);
                    if (match) {
                        const date = new Date(match[0]);
                        return isNaN(date.getTime()) ? cellText : (includeFormatted ? cellText : date.toISOString());
                    }
                }
                return cellText;
            }
            return null;
            
        case 'attachment':
            const attachmentData = [];
            
            // Look for images
            const images = cell.querySelectorAll('img');
            images.forEach(img => {
                attachmentData.push({
                    type: 'image',
                    url: img.src,
                    filename: img.alt || 'image'
                });
            });
            
            // Look for attachment links
            const links = cell.querySelectorAll('a[href]');
            links.forEach(link => {
                if (!link.href.includes('javascript:')) {
                    attachmentData.push({
                        type: 'file',
                        url: link.href,
                        filename: link.textContent.trim() || 'attachment'
                    });
                }
            });
            
            // Look for attachment previews
            const previews = cell.querySelectorAll('.preview, [class*="preview"]');
            previews.forEach(preview => {
                const img = preview.querySelector('img');
                if (img) {
                    attachmentData.push({
                        type: 'image',
                        url: img.src,
                        filename: img.alt || 'preview'
                    });
                }
            });
            
            return attachmentData.length > 0 ? attachmentData : (cellText || null);
            
        case 'select':
        case 'multipleSelect':
            // Look for select options/pills
            const options = cell.querySelectorAll('.choiceToken, .cellToken, [class*="pill"], [class*="token"]');
            if (options.length > 0) {
                const values = Array.from(options).map(opt => opt.textContent.trim()).filter(Boolean);
                return fieldType === 'select' ? values[0] : values;
            }
            return cellText || null;
            
        case 'foreignKey':
            // Look for linked record indicators
            const linkedRecords = cell.querySelectorAll('.foreign-key-blue, [class*="foreign"], [class*="linked"]');
            if (linkedRecords.length > 0) {
                return Array.from(linkedRecords).map(link => link.textContent.trim()).filter(Boolean);
            }
            return cellText || null;
            
        case 'url':
        case 'email':
            const link = cell.querySelector('a[href]');
            if (link) {
                return includeFormatted ? 
                    { url: link.href, text: link.textContent.trim() } : 
                    link.href;
            }
            return cellText || null;
            
        case 'formula':
        case 'rollup':
            // These often contain computed values, extract the display text
            const computedValue = cell.querySelector('.computed-value, [class*="computed"]');
            if (computedValue) {
                return computedValue.textContent.trim();
            }
            return cellText || null;
            
        default:
            return cellText || null;
    }
}

function getCurrentViewType() {
    // Check URL and UI indicators
    const url = window.location.href;
    if (url.includes('grid')) return 'grid';
    if (url.includes('form')) return 'form';
    if (url.includes('calendar')) return 'calendar';
    if (url.includes('gallery')) return 'gallery';
    if (url.includes('kanban')) return 'kanban';
    
    // Check for view type indicators in the UI
    const viewSelectors = [
        '[data-testid="viewName"]',
        '.viewTab.active',
        '[aria-selected="true"]'
    ];
    
    for (const selector of viewSelectors) {
        const element = document.querySelector(selector);
        if (element) {
            const viewText = element.textContent.toLowerCase();
            if (viewText.includes('grid')) return 'grid';
            if (viewText.includes('form')) return 'form';
            if (viewText.includes('calendar')) return 'calendar';
            if (viewText.includes('gallery')) return 'gallery';
            if (viewText.includes('kanban')) return 'kanban';
        }
    }
    
    return 'grid'; // Default
}

function extractBaseId() {
    const patterns = [
        /\/app([a-zA-Z0-9]+)/,
        /airtable\.com\/([a-zA-Z0-9]+)/,
        /\/([a-zA-Z0-9]{17})/
    ];
    
    for (const pattern of patterns) {
        const match = window.location.href.match(pattern);
        if (match && match[1].startsWith('app')) {
            return match[1];
        }
    }
    return null;
}

function extractTableId() {
    const patterns = [
        /\/tbl([a-zA-Z0-9]+)/,
        /table[=/]([a-zA-Z0-9]+)/
    ];
    
    for (const pattern of patterns) {
        const match = window.location.href.match(pattern);
        if (match) {
            return `tbl${match[1]}`;
        }
    }
    return null;
}

function sleep(time) {
    return new Promise((resolve) => setTimeout(() => resolve(), time));
}