async function execute(params) {
    const { 
        includeExperience = true, 
        includeEducation = true, 
        includeSkills = false, 
        maxExperience = 10,
        waitForLoad = 3000
    } = params;

    const result = {
        profile: {},
        experience: [],
        education: [],
        skills: [],
        metadata: {},
        extractedAt: new Date().toISOString()
    };

    try {
        // Add human-like delays to avoid detection
        await randomDelay(1000, 2000);

        // Wait for profile to load
        await waitForProfileLoad(waitForLoad);

        // Extract basic profile information
        result.profile = await extractBasicInfo();
        await randomDelay(500, 1000);

        // Extract experience if requested
        if (includeExperience) {
            result.experience = await extractExperience(maxExperience);
            await randomDelay(800, 1500);
        }

        // Extract education if requested
        if (includeEducation) {
            result.education = await extractEducation();
            await randomDelay(500, 1000);
        }

        // Extract skills if requested
        if (includeSkills) {
            result.skills = await extractSkills();
            await randomDelay(500, 1000);
        }

        // Add metadata
        result.metadata = {
            url: window.location.href,
            profileId: extractProfileId(),
            extractedSections: {
                experience: includeExperience,
                education: includeEducation,
                skills: includeSkills
            }
        };

        return JSON.stringify(result, null, 2);

    } catch (error) {
        return JSON.stringify({
            error: error.message,
            profile: { url: window.location.href },
            extractedAt: new Date().toISOString()
        }, null, 2);
    }
}

async function waitForProfileLoad(maxWait) {
    const startTime = Date.now();
    
    console.log('Waiting for LinkedIn profile to load...');
    
    const selectors = [
        '.text-heading-xlarge',
        '.pv-text-details__left-panel',
        '.profile-name',
        'h1'
    ];
    
    while (Date.now() - startTime < maxWait) {
        for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element && element.textContent.trim()) {
                console.log('Profile loaded');
                await sleep(500);
                return;
            }
        }
        await sleep(200);
    }
    
    console.log('Profile load timeout reached');
}

async function extractBasicInfo() {
    const profile = {};
    
    console.log('Extracting basic profile info...');
    
    // Name
    const nameSelectors = [
        '.text-heading-xlarge',
        '.pv-text-details__left-panel h1',
        '.profile-name',
        'h1.text-heading-xlarge'
    ];
    const nameElement = findElement(nameSelectors);
    if (nameElement) {
        profile.name = nameElement.textContent.trim();
        console.log('Found name:', profile.name);
    }

    // Headline
    const headlineSelectors = [
        '.text-body-medium.break-words',
        '.pv-text-details__left-panel .text-body-medium',
        '.pv-top-card--list-bullet .text-body-medium'
    ];
    const headlineElement = findElement(headlineSelectors);
    if (headlineElement) {
        profile.headline = headlineElement.textContent.trim();
        console.log('Found headline:', profile.headline);
    }

    // Location
    const locationSelectors = [
        '.text-body-small.inline.t-black--light.break-words',
        '.pv-text-details__left-panel .text-body-small',
        '.pv-top-card--list-bullet .text-body-small'
    ];
    const locationElements = document.querySelectorAll(locationSelectors.join(', '));
    for (const element of locationElements) {
        const text = element.textContent.trim();
        if (text && !text.includes('connections') && !text.includes('followers')) {
            profile.location = text;
            console.log('Found location:', profile.location);
            break;
        }
    }

    // Connection count
    const connectionSelectors = [
        '.text-body-small a[href*="connections"]',
        '.pv-top-card--list-bullet li a'
    ];
    const connectionElement = findElement(connectionSelectors);
    if (connectionElement) {
        const match = connectionElement.textContent.match(/(\d+[\+,\d]*)/);
        profile.connections = match ? match[1] : null;
        console.log('Found connections:', profile.connections);
    }

    return profile;
}

async function extractExperience(maxEntries) {
    const experience = [];
    
    console.log('Extracting experience...');
    
    // Scroll to experience section
    const experienceSection = document.querySelector('#experience');
    if (experienceSection) {
        experienceSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await randomDelay(1000, 1500);
        console.log('Scrolled to experience section');
    }

    // Updated selectors based on the actual HTML structure
    const experienceContainer = document.querySelector('#experience').closest('section');
    if (!experienceContainer) {
        console.log('Experience container not found');
        return experience;
    }
    
    // Look for experience items within the experience section
    const experienceItems = experienceContainer.querySelectorAll('.artdeco-list__item');
    console.log(`Found ${experienceItems.length} experience items`);

    const limit = Math.min(maxEntries, experienceItems.length);
    
    for (let i = 0; i < limit; i++) {
        const item = experienceItems[i];
        
        console.log(`Processing experience item ${i + 1}`);
        
        // Extract title/position - updated selector
        const titleElement = item.querySelector('.mr1.hoverable-link-text.t-bold span[aria-hidden="true"]');
        const title = titleElement ? titleElement.textContent.trim() : '';
        
        // Extract company - look for the second span with company info
        const companySpans = item.querySelectorAll('.t-14.t-normal span[aria-hidden="true"]');
        let company = '';
        let employmentType = '';
        
        if (companySpans.length > 0) {
            const companyText = companySpans[0].textContent.trim();
            // Split company and employment type (e.g., "AIMarketCap · Contract")
            const parts = companyText.split(' · ');
            company = parts[0] || '';
            employmentType = parts[1] || '';
        }

        // Extract duration
        const durationElement = item.querySelector('.pvs-entity__caption-wrapper');
        const duration = durationElement ? durationElement.textContent.trim() : '';

        // Extract location - look through all location spans more systematically
        const allLocationSpans = item.querySelectorAll('.t-14.t-normal.t-black--light span[aria-hidden="true"]');
        let location = '';
        
        for (const span of allLocationSpans) {
            const text = span.textContent.trim();
            // Location typically contains geographic indicators and doesn't contain duration words
            if (text && 
                (text.includes(',') || text.includes('Remote') || text.includes('On-site') || text.includes('Hybrid')) &&
                !text.includes('Present') && 
                !text.includes('mos') && 
                !text.includes('yr') &&
                !text.includes('·') === false) { // Allow text with · for "City · Remote" patterns
                location = text;
                break;
            }
        }

        // Extract description - handle both collapsed and expanded states
        let description = '';
        
        // Try multiple description selectors
        const descriptionSelectors = [
            '.inline-show-more-text--is-collapsed span[aria-hidden="true"]',
            '.inline-show-more-text span[aria-hidden="true"]',
            '.HsZaGcSxLILeaDYsyAvGDGGvlriOZwvoiE span[aria-hidden="true"]',
            '.pvs-entity__description span[aria-hidden="true"]'
        ];
        
        for (const selector of descriptionSelectors) {
            const descElement = item.querySelector(selector);
            if (descElement) {
                const fullText = descElement.textContent.trim();
                // Only take if it's substantial content (not just company name or duration)
                if (fullText.length > 50 && 
                    !fullText.includes('Show credential') &&
                    !fullText.includes('skills')) {
                    description = fullText;
                    break;
                }
            }
        }
        
        // Remove any trailing truncation and clean up
        if (description) {
            description = description.replace(/\s*…\s*$/, '').trim();
            // Limit to reasonable length but don't cut mid-word
            if (description.length > 500) {
                description = description.substring(0, 500);
                const lastSpace = description.lastIndexOf(' ');
                if (lastSpace > 400) {
                    description = description.substring(0, lastSpace) + '...';
                }
            }
        }

        if (title || company) {
            const experienceEntry = {
                title: title,
                company: company,
                employmentType: employmentType,
                duration: duration,
                location: location,
                description: description
            };
            
            // Only include fields that have meaningful content
            if (!experienceEntry.location) delete experienceEntry.location;
            if (!experienceEntry.description) delete experienceEntry.description;
            if (!experienceEntry.employmentType) delete experienceEntry.employmentType;
            
            console.log('Extracted experience:', experienceEntry);
            experience.push(experienceEntry);
        }
    }

    console.log(`Extracted ${experience.length} experience entries`);
    return experience;
}

async function extractEducation() {
    const education = [];
    
    console.log('Extracting education...');
    
    // Scroll to education section
    const educationSection = document.querySelector('#education');
    if (educationSection) {
        educationSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await randomDelay(1000, 1500);
        console.log('Scrolled to education section');
    }

    // Find education section container
    const educationContainer = document.querySelector('#education').closest('section');
    if (!educationContainer) {
        console.log('Education container not found');
        return education;
    }

    const educationItems = educationContainer.querySelectorAll('.artdeco-list__item');
    console.log(`Found ${educationItems.length} education items`);

    educationItems.forEach((item, index) => {
        console.log(`Processing education item ${index + 1}`);
        
        // Extract school name
        const schoolElement = item.querySelector('.mr1.hoverable-link-text.t-bold span[aria-hidden="true"]');
        const school = schoolElement ? schoolElement.textContent.trim() : '';

        // Extract degree
        const degreeSpans = item.querySelectorAll('.t-14.t-normal span[aria-hidden="true"]');
        const degree = degreeSpans.length > 0 ? degreeSpans[0].textContent.trim() : '';

        // Extract year/duration
        const yearElement = item.querySelector('.pvs-entity__caption-wrapper');
        const year = yearElement ? yearElement.textContent.trim() : '';

        // Extract grade/additional info
        const gradeElement = item.querySelector('.inline-show-more-text--is-collapsed span[aria-hidden="true"]');
        const grade = gradeElement ? gradeElement.textContent.trim() : '';

        if (school || degree) {
            const educationEntry = {
                school: school,
                degree: degree,
                year: year,
                grade: grade
            };
            
            // Only include fields that have meaningful content
            if (!educationEntry.grade) delete educationEntry.grade;
            if (!educationEntry.year) delete educationEntry.year;
            
            console.log('Extracted education:', educationEntry);
            education.push(educationEntry);
        }
    });

    console.log(`Extracted ${education.length} education entries`);
    return education;
}

async function extractSkills() {
    const skills = [];
    
    console.log('Extracting skills...');
    
    // Scroll to skills section
    const skillsSection = document.querySelector('#skills');
    if (skillsSection) {
        skillsSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await randomDelay(1000, 1500);
        console.log('Scrolled to skills section');
    }

    // Find skills section container
    const skillsContainer = document.querySelector('#skills').closest('section');
    if (!skillsContainer) {
        console.log('Skills container not found');
        return skills;
    }

    const skillItems = skillsContainer.querySelectorAll('.artdeco-list__item');
    console.log(`Found ${skillItems.length} skill items`);

    skillItems.forEach((item, index) => {
        console.log(`Processing skill item ${index + 1}`);
        
        // Extract skill name
        const skillElement = item.querySelector('.mr1.hoverable-link-text.t-bold span[aria-hidden="true"]');
        const skill = skillElement ? skillElement.textContent.trim() : '';

        // Extract endorsements or related info
        const endorsementElement = item.querySelector('.t-14.t-normal.t-black span[aria-hidden="true"]');
        const endorsementText = endorsementElement ? endorsementElement.textContent.trim() : '';
        
        // Try to extract number of endorsements
        const endorsementMatch = endorsementText.match(/(\d+)/);
        const endorsements = endorsementMatch ? parseInt(endorsementMatch[1]) : 0;

        if (skill) {
            const skillEntry = {
                skill: skill,
                endorsements: endorsements,
                context: endorsementText
            };
            
            // Only include fields that have meaningful content
            if (!skillEntry.context) delete skillEntry.context;
            if (skillEntry.endorsements === 0) delete skillEntry.endorsements;
            
            console.log('Extracted skill:', skillEntry);
            skills.push(skillEntry);
        }
    });

    console.log(`Extracted ${skills.length} skill entries`);
    return skills;
}

function extractProfileId() {
    const match = window.location.href.match(/\/in\/([^\/\?]+)/);
    return match ? match[1] : null;
}

function findElement(selectors) {
    for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent.trim()) {
            return element;
        }
    }
    return null;
}

function findElementText(container, selectors) {
    for (const selector of selectors) {
        const element = container.querySelector(selector);
        if (element && element.textContent.trim()) {
            return element.textContent.trim();
        }
    }
    return null;
}

async function randomDelay(min, max) {
    const delay = Math.random() * (max - min) + min;
    await sleep(delay);
}

function sleep(time) {
    return new Promise((resolve) => setTimeout(() => resolve(), time));
}