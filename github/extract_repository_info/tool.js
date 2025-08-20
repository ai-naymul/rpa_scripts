async function execute(params) {
    const result = {
        repository: {},
        files: [],
        languages: [],
        readme: "",
        extractedAt: new Date().toISOString()
    };

    try {
        console.log("🔍 Starting GitHub repository extraction...");

        // Extract repository name from URL and DOM - UPDATED for real structure
        result.repository.url = window.location.href;
        
        // Extract repo name from the actual DOM structure
        const repoNameSelectors = [
            'a[data-pjax="#repo-content-pjax-container"][href*="/"]',
            'a[data-turbo-frame="repo-content-turbo-frame"]',
            'h1 strong a',
            'h1 a'
        ];
        
        const nameElement = findElement(repoNameSelectors);
        if (nameElement) {
            const repoName = nameElement.textContent.trim();
            const href = nameElement.getAttribute('href');
            // Construct full repo name (owner/repo)
            if (href) {
                const pathParts = href.split('/').filter(p => p);
                if (pathParts.length >= 2) {
                    result.repository.name = `${pathParts[0]}/${pathParts[1]}`;
                } else {
                    result.repository.name = repoName;
                }
            } else {
                result.repository.name = repoName;
            }
            console.log("Found repository:", result.repository.name);
        } else {
            // Fallback: extract from URL
            const urlMatch = window.location.pathname.match(/\/([^\/]+\/[^\/]+)/);
            if (urlMatch) {
                result.repository.name = urlMatch[1];
                console.log("Extracted from URL:", result.repository.name);
            }
        }

        // Extract description - UPDATED selectors
        const descSelectors = [
            'p[data-pjax="#repo-content-pjax-container"]',
            '[itemprop="about"]',
            '.f4.my-3',
            '.BorderGrid-cell p.f4'
        ];
        const descElement = findElement(descSelectors);
        if (descElement) {
            result.repository.description = descElement.textContent.trim();
            console.log("Found description");
        }

        // Extract statistics - UPDATED selectors
        const statsMap = {
            stars: [
                '#repo-stars-counter-star',
                '.js-social-count[href*="stargazers"]',
                'a[href*="/stargazers"] strong',
                'a[href*="/stargazers"] span',
                '.Counter[title*="star"]'
            ],
            forks: [
                '#repo-network-counter',
                '.js-social-count[href*="forks"]',
                'a[href*="/forks"] strong', 
                'a[href*="/forks"] span',
                '.Counter[title*="fork"]'
            ],
            watchers: [
                '#repo-watchers-counter',
                '.js-social-count[href*="watchers"]',
                'a[href*="/watchers"] strong',
                'a[href*="/watchers"] span'
            ]
        };

        for (const [statName, selectors] of Object.entries(statsMap)) {
            const element = findElement(selectors);
            if (element) {
                result.repository[statName] = parseNumber(element.textContent);
                console.log(`Found ${statName}:`, result.repository[statName]);
            }
        }

        // Extract file structure if requested - UPDATED for actual DOM
        if (params.includeFiles) {
            console.log("Extracting files...");
            await extractFiles(result, params.maxFiles || 50);
        }

        // Extract language statistics if requested  
        if (params.includeLanguages) {
            console.log("Extracting languages...");
            await extractLanguages(result);
        }

        // Extract README if requested - UPDATED for actual DOM
        if (params.includeReadme) {
            console.log("Extracting README...");
            await extractReadme(result);
        }

        console.log("Extraction completed successfully!");
        return JSON.stringify(result, null, 2);

    } catch (error) {
        console.error("Extraction failed:", error);
        return JSON.stringify({
            error: error.message,
            repository: { url: window.location.href },
            extractedAt: new Date().toISOString()
        }, null, 2);
    }
}

async function extractFiles(result, maxFiles) {
    // UPDATED FILE SELECTORS based on actual DOM structure
    const fileSelectors = [
        '.react-directory-row',
        'tr[id^="folder-row-"]',
        'tr[id^="file-row-"]',
        '.js-navigation-item',
        '[data-testid="file-row"]'
    ];
    
    let fileElements = [];
    
    // Try each selector
    for (const selector of fileSelectors) {
        fileElements = document.querySelectorAll(selector);
        if (fileElements.length > 0) {
            console.log(`Found ${fileElements.length} files using selector: ${selector}`);
            break;
        }
    }

    if (fileElements.length === 0) {
        console.warn("No file elements found - trying alternative approach");
        return;
    }

    const limit = Math.min(maxFiles, fileElements.length);
    console.log(`Processing ${limit} files...`);

    for (let i = 0; i < limit; i++) {
        const file = fileElements[i];
        
        // Look for the file link in the react-directory structure
        const nameLink = file.querySelector('a[href*="/blob/"], a[href*="/tree/"], .Link--primary[href*="/"]');
        
        if (nameLink && nameLink.href) {
            const fileName = nameLink.textContent.trim() || 
                           nameLink.getAttribute('title') ||
                           nameLink.getAttribute('aria-label')?.split(',')[0] ||
                           nameLink.href.split('/').pop();
            
            if (fileName && fileName !== '') {
                // Try to find timestamp - look in the same row
                const timeElement = file.querySelector('relative-time, time-ago, time[datetime]');
                
                // Determine if it's a directory or file
                const isDirectory = nameLink.href.includes('/tree/') || 
                                  nameLink.getAttribute('aria-label')?.includes('Directory') ||
                                  file.querySelector('.octicon-file-directory-fill, .icon-directory');
                
                result.files.push({
                    name: fileName,
                    type: isDirectory ? 'directory' : 'file',
                    url: nameLink.href,
                    lastModified: timeElement ? timeElement.getAttribute('datetime') : null
                });
            }
        }
    }
    
    console.log(`Extracted ${result.files.length} files`);
}

async function extractLanguages(result) {
    // Language extraction (this part seems to be working already)
    const langBarSelectors = [
        '.BorderGrid-row .ml-3 .Progress',
        '.repository-lang-stats-graph',
        '[data-testid="language-stats"]'
    ];
    
    const langBar = findElement(langBarSelectors);
    if (langBar) {
        console.log("Clicking language bar to expand...");
        simulateClick(langBar);
        await sleep(800);
    }

    // UPDATED LANGUAGE SELECTORS
    const langSelectors = [
        '.BorderGrid-row .ml-3 .d-flex .text-mono',
        '[data-ga-click*="language"]',
        '.repository-lang-stats .lang',
        '.Progress-item'
    ];
    
    let langElements = [];
    for (const selector of langSelectors) {
        langElements = document.querySelectorAll(selector);
        if (langElements.length > 0) {
            console.log(`Found ${langElements.length} languages using: ${selector}`);
            break;
        }
    }

    // Process language elements
    result.languages = Array.from(langElements).map(lang => {
        const text = lang.textContent.trim();
        const match = text.match(/(.+?)\s+([\d.]+%)/);
        return match ? 
            { name: match[1], percentage: match[2] } : 
            { name: text, percentage: 'unknown' };
    }).filter(lang => lang.name && lang.name !== '');
    
    console.log(`Extracted ${result.languages.length} languages`);
}

async function extractReadme(result) {
    // UPDATED README SELECTORS based on actual DOM
    const readmeSelectors = [
        'article.markdown-body.entry-content.container-lg',
        '[data-testid="readme"] .Box-body',
        '#readme .Box-body',
        '.readme .Box-body',
        'article[itemprop="text"]',
        '.Box .markdown-body'
    ];
    
    let readmeElement = findElement(readmeSelectors);
    
    // If not found, try to find and click README file link
    if (!readmeElement) {
        console.log("README not visible, looking for README file...");
        const readmeLink = document.querySelector('a[href*="README"], a[title*="README"], a[aria-label*="README"]');
        if (readmeLink) {
            console.log("Found README link, clicking...");
            simulateClick(readmeLink);
            await sleep(800);
            readmeElement = findElement(readmeSelectors);
        }
    }
    
    if (readmeElement) {
        // Extract the text content, limiting length
        let readmeText = readmeElement.textContent.trim();
        result.readme = readmeText.substring(0, 3000); // Increased limit
        console.log(`Extracted README (${result.readme.length} characters)`);
    } else {
        console.warn("README not found or not accessible");
        
        // Alternative: try to find README in file list and extract first few lines
        const readmeFileLink = document.querySelector('a[href*="/blob/"][href*="README"]');
        if (readmeFileLink) {
            result.readme = "README file found but content not accessible from main page";
            console.log("README file link found but content not extracted");
        }
    }
}

// Helper functions
function findElement(selectors) {
    for (const selector of selectors) {
        try {
            const element = document.querySelector(selector);
            if (element && (element.textContent.trim() || element.href)) {
                return element;
            }
        } catch (e) {
            console.warn(`Invalid selector: ${selector}`);
        }
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

// ===== ENHANCED TEST FUNCTION =====
async function testWithDebugging() {
    console.log("Starting GitHub extraction test...");
    console.log("Current URL:", window.location.href);
    
    const result = await execute({
        includeFiles: true,
        includeLanguages: true, 
        includeReadme: true,
        maxFiles: 15
    });
    
    const parsed = JSON.parse(result);
    
    console.log("\n EXTRACTION SUMMARY:");
    console.log("=".repeat(50));
    console.log("Repository:", parsed.repository?.name || "Not Found");
    console.log("URL:", parsed.repository?.url || "Not found");
    console.log("Description:", parsed.repository?.description ? "Found" : "Not found");
    console.log("Stars:", parsed.repository?.stars || "Not found");
    console.log("Forks:", parsed.repository?.forks || "Not fouund");
    console.log("Files:", parsed.files?.length || 0);
    console.log("Languages:", parsed.languages?.length || 0);
    console.log("README:", parsed.readme ? `✅ ${parsed.readme.length} chars` : "Not found");
    console.log("=".repeat(50));
    
    if (parsed.files?.length > 0) {
        console.log("\n Sample files:");
        parsed.files.slice(0, 5).forEach(file => {
            console.log(`  ${file.type === 'directory' ? '📁' : '📄'} ${file.name}`);
        });
    }
    
    if (parsed.languages?.length > 0) {
        console.log("\n Languages:");
        parsed.languages.forEach(lang => {
            console.log(`  ${lang.name}: ${lang.percentage}`);
        });
    }
    
    return parsed;
}

console.log("GitHub tool loaded! run the test function to see it in action.");