async function execute(params) {
    const { query, language, sort = "best-match", maxResults = 10 } = params;

    try {
        // Build complete search URL with all parameters
        const searchUrl = buildSearchUrl(query, language, sort);
        
        // Navigate to complete URL if we're not already there
        if (window.location.href !== searchUrl) {
            console.log(`Navigating to: ${searchUrl}`);
            window.location.href = searchUrl;
            await sleep(800);
        }

        // Ensure we're on repositories tab (fallback)
        await ensureRepositoriesTab();

        // Extract results
        const results = await extractSearchResults(maxResults);

        return JSON.stringify({
            query: query,
            language: language || 'all',
            sort: sort,
            totalFound: results.length,
            results: results,
            extractedAt: new Date().toISOString()
        }, null, 2);

    } catch (error) {
        return JSON.stringify({
            error: error.message,
            query: query,
            extractedAt: new Date().toISOString()
        }, null, 2);
    }
}

// Build complete search URL with all parameters upfront
function buildSearchUrl(query, language, sort) {
    const baseUrl = 'https://github.com/search';
    const url = new URL(baseUrl);
    
    // Build query string
    let searchQuery = query;
    if (language) {
        searchQuery += ` language:${language}`;
    }
    
    // Set URL parameters
    url.searchParams.set('q', searchQuery);
    url.searchParams.set('type', 'repositories');
    
    // Add sorting if not best-match
    if (sort && sort !== 'best-match') {
        const validSorts = ['stars', 'forks', 'updated', 'created'];
        if (validSorts.includes(sort)) {
            url.searchParams.set('s', sort);
            url.searchParams.set('o', 'desc');
        }
    }
    
    return url.toString();
}

async function navigateToSearch(query) {
    const searchSelectors = [
        '.header-search-input',
        '[data-testid="search-input"]',
        'input[name="q"]'
    ];

    const searchInput = findElement(searchSelectors);
    if (searchInput) {
        searchInput.value = query;
        searchInput.form.submit();
        await sleep(800);
    } else {
        window.location.href = `/search?q=${encodeURIComponent(query)}&type=repositories`;
        await sleep(800);
    }
}

async function ensureRepositoriesTab() {
    const repoTabSelectors = [
        'a[href*="type=repositories"]',
        '.menu-item[href*="type=repositories"]',
        '.UnderlineNav-item[href*="type=repositories"]'
    ];

    const repoTab = findElement(repoTabSelectors);
    if (repoTab && !repoTab.classList.contains('selected') && !repoTab.getAttribute('aria-current')) {
        simulateClick(repoTab);
        await sleep(800);
    }
}

async function applyLanguageFilter(language) {
    // Try to find language in sidebar
    const langLinks = document.querySelectorAll('a[href*="language:"], .filter-item');
    
    for (const link of langLinks) {
        if (link.textContent.toLowerCase().includes(language.toLowerCase()) || 
            link.href.includes(`language:${language}`)) {
            simulateClick(link);
            await sleep(800);
            return;
        }
    }

    // If not found in sidebar, modify URL
    const currentUrl = new URL(window.location.href);
    const currentQuery = currentUrl.searchParams.get('q') || '';
    const newQuery = `${currentQuery} language:${language}`;
    currentUrl.searchParams.set('q', newQuery);
    window.location.href = currentUrl.toString();
    await sleep(800);
}

async function applySortFilter(sort) {
    // Valid GitHub sort options
    const validSorts = ['stars', 'forks', 'updated', 'created', 'best-match'];
    
    if (!validSorts.includes(sort)) {
        console.warn(`Invalid sort option: ${sort}. Valid options: ${validSorts.join(', ')}`);
        return;
    }

    const currentUrl = new URL(window.location.href);
    
    if (sort === 'best-match') {
        // Remove sort parameters for best match (default)
        currentUrl.searchParams.delete('s');
        currentUrl.searchParams.delete('o');
    } else {
        // Set sort parameter and order
        currentUrl.searchParams.set('s', sort);
        currentUrl.searchParams.set('o', 'desc'); // Most stars, most forks, etc.
    }
    
    console.log(`Applying sort: ${sort}, URL: ${currentUrl.toString()}`);
    window.location.href = currentUrl.toString();
    await sleep(800);
}

// UPDATED: Generalized selectors to work across different GitHub layouts
async function extractSearchResults(maxResults) {
    // Try multiple selectors for different GitHub layouts
    const resultSelectors = [
        '.Box-sc-g0xbh4-0.gPrlij',  // Current GitHub structure
        '.repo-list-item',          // Classic layout
        '[data-testid="results-list"] > div', // Data attribute fallback
        '.search-result-item',      // Alternative layout
        'article[data-testid*="result"]', // Semantic fallback
        '.package-list-item'        // Package results fallback
    ];

    let resultElements = [];
    for (const selector of resultSelectors) {
        resultElements = document.querySelectorAll(selector);
        if (resultElements.length > 0) {
            console.log(`Found ${resultElements.length} results using selector: ${selector}`);
            break;
        }
    }

    if (resultElements.length === 0) {
        console.warn('No result elements found with any selector');
        return [];
    }

    const results = [];
    const limit = Math.min(maxResults, resultElements.length);
    
    for (let i = 0; i < limit; i++) {
        const item = resultElements[i];
        
        // Generalized name/link selectors
        const nameLink = findElementInItem(item, [
            'a.prc-Link-Link-85e08[href*="/"]',  // Current structure
            '.search-title a',                   // Alternative
            'h3 a',                             // Classic
            'a[href*="/"][data-testid*="result"]', // Data attribute
            '.f4 a',                            // Legacy
            'a[href^="/"][href*="/"]'           // Generic repo link
        ]);
        
        // Fixed description selector - target the specific span structure
        const description = findElementInItem(item, [
            '.Box-sc-g0xbh4-0.gKFdvh.search-match.prc-Text-Text-0ima0', // Exact current structure
            'span.gKFdvh.search-match',         // Simplified current
            '.search-match:not(em):not(.search-title)', // Generic search match excluding title
            'p.mb-1',                           // Legacy description
            '.search-result-description',       // Alternative
            'p.color-text-secondary',          // GitHub secondary text
            '[data-testid*="description"]'     // Data attribute fallback
        ]);
        
        // Generalized language selectors
        const language = findElementInItem(item, [
            'span[aria-label*="language"]',     // Current structure
            '[itemprop="programmingLanguage"]', // Microdata
            '.f6 .mr-3',                       // Legacy
            '.language',                       // Generic class
            'span[aria-label$=" language"]'    // Aria label ending with "language"
        ]);
        
        // Generalized stars selectors
        const stars = findElementInItem(item, [
            'a[href*="/stargazers"] .prc-Text-Text-0ima0', // Current
            'a[href*="/stargazers"]',           // Generic stargazers link
            '.octicon-star + span',             // Icon + text
            '.octicon-star',                    // Just the icon
            '[aria-label*="star"]'              // Aria label fallback
        ]);
        
        // Generalized time selectors
        const updated = findElementInItem(item, [
            'span[title*="202"]',               // Year in title
            'span[title*="ago"]',               // "ago" in title
            '.prc-Truncate-Truncate-A9Wn6 span[title]', // Current structure
            'relative-time',                    // Legacy
            'time-ago',                        // Alternative
            'time[datetime]',                  // Semantic time
            '[title*="Updated"]'               // Generic updated text
        ]);
        
        if (nameLink) {
            const result = {
                name: cleanText(nameLink.textContent),
                url: normalizeUrl(nameLink.href || nameLink.getAttribute('href')),
                description: description ? cleanText(description.textContent) : '',
                language: language ? cleanText(language.textContent) : '',
                lastUpdated: updated ? getTimeValue(updated) : ''
            };

            // Extract stars with better parsing
            if (stars) {
                result.stars = parseStarCount(stars);
            }

            results.push(result);
        }
    }

    return results;
}

// Helper function to find element using multiple selectors
function findElementInItem(item, selectors) {
    for (const selector of selectors) {
        const element = item.querySelector(selector);
        if (element) return element;
    }
    return null;
}

// Helper function to clean text content
function cleanText(text) {
    if (!text) return '';
    return text.trim().replace(/\s+/g, ' ').replace(/\n/g, ' ');
}

// Helper function to normalize URLs
function normalizeUrl(url) {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    if (url.startsWith('/')) return `https://github.com${url}`;
    return url;
}

// Helper function to extract time value
function getTimeValue(element) {
    return element.getAttribute('title') || 
           element.getAttribute('datetime') || 
           element.textContent.trim() || '';
}

// Enhanced star count parsing
function parseStarCount(element) {
    let text = element.textContent || element.getAttribute('aria-label') || '';
    
    // Check parent elements for star count if not found directly
    if (!text || text.length < 1) {
        const parent = element.closest('a[href*="/stargazers"]');
        if (parent) text = parent.textContent || parent.getAttribute('aria-label') || '';
    }
    
    return parseNumber(text);
}

function findElement(selectors) {
    for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) return element;
    }
    return null;
}

function parseNumber(text) {
    if (!text) return 0;
    const cleanText = text.replace(/[^\d.k]/gi, '');
    const multiplier = text.toLowerCase().includes('k') ? 1000 : 1;
    return parseFloat(cleanText) * multiplier || 0;
}

function simulateClick(element) {
    const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window
    });
    element.dispatchEvent(clickEvent);
}

function sleep(time) {
    return new Promise((resolve) => setTimeout(() => resolve(), time));
}