// Domain Models
class Company {
  constructor() {
    this.name = null;
    this.industry = null;
    this.employeeCount = null;
    this.followers = null;
    this.headquarters = null;
    this.verified = false;
    // Removed: description, website, logo (unreliable/not in schema)
  }
}

class CompanyUpdate {
  constructor() {
    this.content = null;
    this.timestamp = null;
    this.engagement = {
      likes: '0',
      comments: '0',
      reposts: '0'
    };
    this.type = null; // 'post', 'article', 'video', 'repost'
    this.author = null;
    this.media = [];
  }
}

class Employee {
  constructor() {
    this.name = null;
    this.title = null;
    this.profileUrl = null;
    this.connectionDegree = null;
  }
}

class ExtractionResult {
  constructor() {
    this.company = new Company();
    this.employees = [];
    this.updates = [];
    this.metadata = {
      url: null,
      companyId: null,
      extractedSections: {},
      extractedAt: null,
      extractionConfig: {}
    };
  }
}

// Configuration Management
class ScrapingConfig {
  constructor(params = {}) {
    this.includeEmployees = params.includeEmployees ?? false;
    this.includeUpdates = params.includeUpdates ?? true;
    this.maxUpdates = params.maxUpdates ?? 5;
    this.maxEmployees = params.maxEmployees ?? 10;
    this.waitForLoad = params.waitForLoad ?? 3000;
    this.includeMedia = params.includeMedia ?? false;
    this.respectPrivacy = params.respectPrivacy ?? true;
    // Removed fetchFullDescription option
  }
}

// Element Selection Strategy
class ElementSelector {
  static findBySelectors(selectors, container = document) {
    for (const selector of selectors) {
      try {
        // Skip pseudo-selectors like :contains() which aren't supported in querySelector
        if (selector.includes(':contains(')) {
          continue;
        }
        const element = container.querySelector(selector);
        if (element && element.textContent?.trim()) {
          return element;
        }
      } catch (e) {
        console.warn(`Invalid selector: ${selector}`);
      }
    }
    return null;
  }

  static findAllBySelectors(selectors, container = document) {
    for (const selector of selectors) {
      try {
        // Skip pseudo-selectors like :contains() which aren't supported in querySelector
        if (selector.includes(':contains(')) {
          continue;
        }
        const elements = container.querySelectorAll(selector);
        if (elements.length > 0) {
          return Array.from(elements);
        }
      } catch (e) {
        console.warn(`Invalid selector: ${selector}`);
      }
    }
    return [];
  }

  static extractText(element) {
    if (!element) return null;
    let text = element.textContent?.trim() || null;
    if (text) {
      // Clean up whitespace and line breaks
      text = text.replace(/\s+/g, ' ').trim();
      // Remove "hashtag" prefix that appears in extracted content
      text = text.replace(/hashtag#/g, '#');
    }
    return text;
  }

  static extractAttribute(element, attribute) {
    if (!element) return null;
    return element.getAttribute(attribute);
  }
}

// Company Information Extractor
class CompanyExtractor {
  static async extract() {
    const company = new Company();

    // Company name - core field
    const nameSelectors = [
      '.org-top-card-summary__title',
      'h1[data-testid="company-name"]',
      '.company-name',
      'h1.text-heading-xlarge',
      '.org-top-card-primary-content__title h1',
      '[data-test="company-name"]'
    ];
    const nameElement = ElementSelector.findBySelectors(nameSelectors);
    company.name = ElementSelector.extractText(nameElement);

    // Industry - reliable field
    const industrySelectors = [
      '.org-top-card-summary__industry',
      '[data-testid="company-industry"]',
      '.industry',
      '.org-top-card-summary-info-list__info-item:first-child'
    ];
    const industryElement = ElementSelector.findBySelectors(industrySelectors);
    company.industry = ElementSelector.extractText(industryElement);

    // Employee count - reliable field
    company.employeeCount = this.extractEmployeeCount();

    // Followers - reliable field
    const followerSelectors = [
      '.org-top-card-summary-info-list__info-item',
      '.org-top-card-summary__info-item'
    ];
    const followerElements = ElementSelector.findAllBySelectors(followerSelectors);
    for (const element of followerElements) {
      const text = ElementSelector.extractText(element);
      if (text && text.toLowerCase().includes('followers')) {
        company.followers = text;
        break;
      }
    }

    // Headquarters - reliable field
    company.headquarters = this.extractHeadquarters();

    // Verified status - reliable field
    company.verified = this.isVerified();

    return company;
  }

  static extractEmployeeCount() {
    const sizeSelectors = [
      '.org-top-card-summary__info-item',
      '[data-testid="company-size"]',
      '.company-size',
      'a[href*="search/results/people"]'
    ];
    
    const elements = ElementSelector.findAllBySelectors(sizeSelectors);
    for (const element of elements) {
      const text = ElementSelector.extractText(element);
      if (text && (text.includes('employee') || text.includes('size') || text.match(/\d+[KM]?\+?\s*employee/i))) {
        return text;
      }
    }
    return null;
  }

  static extractHeadquarters() {
    const locationSelectors = [
      '.org-top-card-summary-info-list__info-item',
      '.org-about-company-module__company-details .text-md',
      '[data-testid="company-locations"]',
      '.company-location'
    ];
    
    const elements = ElementSelector.findAllBySelectors(locationSelectors);
    for (const element of elements) {
      const text = ElementSelector.extractText(element);
      if (text && 
          !text.includes('http') && 
          !text.includes('@') && 
          !text.toLowerCase().includes('employee') && 
          !text.toLowerCase().includes('followers') &&
          !text.toLowerCase().includes('software') &&
          text.length > 3) {
        return text;
      }
    }
    return null;
  }

  static isVerified() {
    const verifiedSelectors = [
      'svg[data-test-icon="verified-medium"]',
      '[data-testid="verified-badge"]',
      '.verified-badge',
      '.org-top-card-summary__badge svg',
      'svg[aria-label="Verified"]'
    ];
    
    // Check if any verified icon exists
    for (const selector of verifiedSelectors) {
      try {
        const element = document.querySelector(selector);
        if (element) {
          return true;
        }
      } catch (e) {
        continue;
      }
    }
    
    return false;
  }
}


// Updates Extractor
class UpdatesExtractor {
  static async extract(maxUpdates = 5) {
    await this.scrollToUpdatesSection();
    await this.randomDelay(1500, 2000);

    const updateSelectors = [
      '.org-company-posts .feed-shared-update-v2',
      '.company-updates .update-item',
      '[data-testid="company-update"]',
      '.feed-shared-update-v2',
      'article[data-urn*="activity"]'
    ];

    const updateElements = ElementSelector.findAllBySelectors(updateSelectors);
    const updates = [];
    const limit = Math.min(maxUpdates, updateElements.length);

    for (let i = 0; i < limit; i++) {
      const update = await this.extractSingleUpdate(updateElements[i]);
      if (update.content) {
        updates.push(update);
      }
    }

    return updates;
  }

  static async extractSingleUpdate(updateElement) {
    const update = new CompanyUpdate();

    // Content extraction with fallbacks
    const contentSelectors = [
      '.feed-shared-text',
      '.update-content',
      '.feed-shared-inline-show-more-text',
      '.update-components-text',
      '.feed-shared-update-v2__description'
    ];
    
    const contentElement = ElementSelector.findBySelectors(contentSelectors, updateElement);
    if (contentElement) {
      update.content = ElementSelector.extractText(contentElement).substring(0, 500);
    }

    // Timestamp extraction
    const timestampSelectors = [
      'time',
      '.update-time',
      '.feed-shared-actor__sub-description time',
      '.update-components-actor__sub-description',
      '[data-testid="timestamp"]'
    ];
    
    const timestampElement = ElementSelector.findBySelectors(timestampSelectors, updateElement);
    if (timestampElement) {
      update.timestamp = ElementSelector.extractAttribute(timestampElement, 'datetime') || 
                        ElementSelector.extractText(timestampElement);
    }

    // Engagement metrics
    update.engagement = this.extractEngagement(updateElement);

    // Update type
    update.type = this.determineUpdateType(updateElement);

    // Author (for reposts)
    update.author = this.extractAuthor(updateElement);

    // Media
    update.media = this.extractMedia(updateElement);

    return update;
  }

  static extractEngagement(updateElement) {
    const engagement = { likes: '0', comments: '0', reposts: '0' };

    // Likes/reactions - better extraction
    const likeSelectors = [
      '.social-details-social-counts__reactions-count',
      '.social-counts-reactions__count-value',
      '.like-count',
      '.social-detail-social-counts'
    ];
    const likeElement = ElementSelector.findBySelectors(likeSelectors, updateElement);
    if (likeElement) {
      const likeText = ElementSelector.extractText(likeElement);
      engagement.likes = likeText.replace(/[^\d,KM]/g, '') || '0';
    }

    // Comments - extract number from text
    const commentSelectors = [
      '.social-details-social-counts__comments button',
      '.social-counts-comments__count-value',
      '.comment-count'
    ];
    const commentElement = ElementSelector.findBySelectors(commentSelectors, updateElement);
    if (commentElement) {
      const commentText = ElementSelector.extractText(commentElement);
      const commentMatch = commentText.match(/(\d+(?:,\d+)*)/);
      engagement.comments = commentMatch ? commentMatch[1] : '0';
    }

    // Reposts - extract number from text  
    const repostSelectors = [
      '[aria-label*="reposts"]',
      '.social-counts-reposts__count-value',
      '.repost-count'
    ];
    const repostElement = ElementSelector.findBySelectors(repostSelectors, updateElement);
    if (repostElement) {
      const repostText = ElementSelector.extractText(repostElement) || 
                        ElementSelector.extractAttribute(repostElement, 'aria-label') || '';
      const repostMatch = repostText.match(/(\d+(?:,\d+)*)/);
      engagement.reposts = repostMatch ? repostMatch[1] : '0';
    }

    return engagement;
  }

  static determineUpdateType(updateElement) {
    if (updateElement.querySelector('.update-components-article')) return 'article';
    if (updateElement.querySelector('.update-components-video, .video-s-loader')) return 'video';
    if (updateElement.querySelector('.update-components-header')) return 'repost';
    if (updateElement.querySelector('.update-components-image')) return 'image_post';
    return 'post';
  }

  static extractAuthor(updateElement) {
    // For reposts, extract original author
    const authorSelectors = [
      '.update-components-actor__title span[dir="ltr"] span[aria-hidden="true"]',
      '.update-components-actor__title span span',
      '.update-components-actor__title',
      '.update-components-header a',
      '.feed-shared-actor__title'
    ];
    
    const authorElement = ElementSelector.findBySelectors(authorSelectors, updateElement);
    let authorText = ElementSelector.extractText(authorElement);
    
    // Clean up author text - remove duplicate names and extra metadata
    if (authorText) {
      // First try to find the clean author name in nested spans
      const cleanSpan = updateElement.querySelector('.update-components-actor__title span[aria-hidden="true"] span');
      if (cleanSpan) {
        const cleanText = ElementSelector.extractText(cleanSpan);
        if (cleanText && cleanText.length > 0) {
          return cleanText.substring(0, 50);
        }
      }
      
      // Fallback: Handle duplicate names manually
      // Split by common patterns that indicate duplicates
      let cleanedText = authorText;
      
      // Handle patterns like "MicrosoftMicrosoft" -> "Microsoft"
      const words = authorText.split(/\s+/);
      if (words.length >= 2) {
        // Check if first word is repeated
        const firstWord = words[0];
        if (words[1] === firstWord) {
          // Remove the duplicate
          cleanedText = words.slice(1).join(' ');
        }
      }
      
      // Additional cleanup for patterns like "Satya NadellaSatya Nadella"
      const halfLength = Math.floor(authorText.length / 2);
      const firstHalf = authorText.substring(0, halfLength);
      const secondHalf = authorText.substring(halfLength);
      
      if (firstHalf === secondHalf) {
        cleanedText = firstHalf;
      }
      
      // Remove metadata
      cleanedText = cleanedText.split('•')[0].trim();
      cleanedText = cleanedText.replace(/following|influencer/gi, '').trim();
      
      return cleanedText.substring(0, 50);
    }
    
    return authorText;
  }

  static extractMedia(updateElement) {
    const media = [];
    const images = updateElement.querySelectorAll('.update-components-image img, .feed-shared-image img');
    
    images.forEach(img => {
      const src = img.getAttribute('src');
      // Filter out LinkedIn's static assets and only include actual content images
      if (src && 
          !src.includes('static.licdn.com/aero-v1/sc/h/') &&
          !src.includes('static.licdn.com/sc/h/') &&
          src.includes('media.licdn.com')) {
        media.push({
          type: 'image',
          url: src,
          alt: img.getAttribute('alt') || ''
        });
      }
    });

    return media;
  }

  static async scrollToUpdatesSection() {
    const updatesSection = document.querySelector('.org-company-posts, .company-updates, .feed-container');
    if (updatesSection) {
      updatesSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  static async randomDelay(min, max) {
    const delay = Math.random() * (max - min) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}

// Employee Extractor
class EmployeeExtractor {
  static async extract(maxEmployees = 10, respectPrivacy = true) {
    if (respectPrivacy) {
      return this.extractLimitedEmployeeInfo();
    }

    const employeeSection = document.querySelector('.org-people, .company-employees');
    if (!employeeSection) return [];

    employeeSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await this.randomDelay(1000, 1500);

    const employeeElements = document.querySelectorAll('.org-people-profile-card, .employee-card');
    const employees = [];
    const limit = Math.min(maxEmployees, employeeElements.length);

    for (let i = 0; i < limit; i++) {
      const employee = this.extractSingleEmployee(employeeElements[i]);
      if (employee.name) {
        employees.push(employee);
      }
    }

    return employees;
  }

  static extractLimitedEmployeeInfo() {
    const totalEmployeesText = document.querySelector('.org-people-bar-graph-element__category')?.textContent;
    const employeeElements = document.querySelectorAll('.org-people-profile-card, .employee-card');
    
    return [{
      totalEmployeesVisible: employeeElements.length,
      totalEmployeesText: totalEmployeesText || 'Not available',
      note: "Limited data for privacy compliance"
    }];
  }

  static extractSingleEmployee(employeeElement) {
    const employee = new Employee();

    const nameSelectors = [
      '.org-people-profile-card__profile-title',
      '.employee-name',
      '.artdeco-entity-lockup__title'
    ];
    const nameElement = ElementSelector.findBySelectors(nameSelectors, employeeElement);
    employee.name = ElementSelector.extractText(nameElement);

    const titleSelectors = [
      '.org-people-profile-card__profile-info',
      '.employee-title',
      '.artdeco-entity-lockup__subtitle'
    ];
    const titleElement = ElementSelector.findBySelectors(titleSelectors, employeeElement);
    employee.title = ElementSelector.extractText(titleElement);

    const linkElement = employeeElement.querySelector('a[href*="/in/"]');
    if (linkElement) {
      employee.profileUrl = linkElement.getAttribute('href');
    }

    return employee;
  }

  static async randomDelay(min, max) {
    const delay = Math.random() * (max - min) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}

// URL and Company ID Extractor
class UrlExtractor {
  static extractCompanyId() {
    const patterns = [
      /\/company\/([^\/\?]+)/,
      /\/showcase\/([^\/\?]+)/,
      /\/school\/([^\/\?]+)/
    ];
    
    for (const pattern of patterns) {
      const match = window.location.href.match(pattern);
      if (match) return match[1];
    }
    return null;
  }

  static getCurrentUrl() {
    return window.location.href;
  }
}

// Wait Strategy
class WaitStrategy {
  static async waitForCompanyLoad(maxWait = 3000) {
    const startTime = Date.now();
    
    const selectors = [
      '.org-top-card-summary__title',
      'h1[data-testid="company-name"]',
      '.company-name',
      'h1'
    ];
    
    while (Date.now() - startTime < maxWait) {
      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent?.trim()) {
          await this.sleep(500);
          return;
        }
      }
      await this.sleep(200);
    }
  }

  static sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Main Execution Engine
async function execute(params = {}) {
    const config = new ScrapingConfig(params);
    const result = new ExtractionResult();

    try {
        // Add human-like delays
        await WaitStrategy.sleep(Math.random() * 1000 + 1000);

        // Wait for page to load
        await WaitStrategy.waitForCompanyLoad(config.waitForLoad);

        // Extract basic company information
        result.company = await CompanyExtractor.extract();
        await WaitStrategy.sleep(Math.random() * 500 + 500);

        // Extract company updates if requested
        if (config.includeUpdates) {
            result.updates = await UpdatesExtractor.extract(config.maxUpdates);
            await WaitStrategy.sleep(Math.random() * 400 + 800);
        }

        // Extract employee information if requested
        if (config.includeEmployees) {
            result.employees = await EmployeeExtractor.extract(
                config.maxEmployees, 
                config.respectPrivacy
            );
        }

        // Add metadata
        result.metadata = {
            url: UrlExtractor.getCurrentUrl(),
            companyId: UrlExtractor.extractCompanyId(),
            extractedSections: {
                updates: config.includeUpdates,
                employees: config.includeEmployees
            },
            extractedAt: new Date().toISOString(),
            extractionConfig: config
        };

        return JSON.stringify(result, null, 2);

    } catch (error) {
        return JSON.stringify({
            error: error.message,
            company: { url: UrlExtractor.getCurrentUrl() },
            extractedAt: new Date().toISOString()
        }, null, 2);
    }
}

// Export for usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { execute, ScrapingConfig };
}