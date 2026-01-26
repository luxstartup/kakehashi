const fs = require('fs');
const path = require('path');

// Configuration
const ALLOWED_IMAGE_DOMAINS = [
    'prtimes.jp',
    'prcdn.freetls.fastly.net',
    'static.prtimes.jp',
    'www.prtimes.jp'
];

// Helper to check domains
function isAllowedDomain(url) {
    if (url.startsWith('http')) {
        try {
            const domain = new URL(url).hostname;
            // Check exact match or subdomain
            return ALLOWED_IMAGE_DOMAINS.some(allowed => domain === allowed || domain.endsWith('.' + allowed));
        } catch (e) {
            return false;
        }
    }
    // Relative paths (local images) are allowed for valid placeholders if they exist
    return true;
}

function validateFile(filePath) {
    console.log(`\n🔍 Validating: ${path.basename(filePath)}`);
    const content = fs.readFileSync(filePath, 'utf-8');
    let errors = [];
    let warnings = [];

    // 1. Copyright / Source Link Check & ID Extraction
    const creditsRegex = /<div class="credits">[\s\S]*?<a href="(https?:\/\/[^"]+)"[^>]*>[\s\S]*?<\/a>[\s\S]*?<\/div>/i;
    const creditsMatch = content.match(creditsRegex);
    let sourceLinkData = null;

    if (!creditsMatch) {
        errors.push("❌ Missing 'div.credits' or source link. Copyright violation risk!");
    } else {
        const sourceUrl = creditsMatch[1];
        if (!sourceUrl.includes('prtimes.jp') && !sourceUrl.includes('go.jp')) { // gov or prtimes
            warnings.push(`⚠️ Source link (${sourceUrl}) might not be an official PR source.`);
        } else {
            console.log(`✅ Source Link verified: ${sourceUrl}`);
            // Try to extract PR Times IDs: keys are usually .../p/000000{REL}.000{COMP}.html
            // Example pattern: /000000112.000145123.html -> Rel: 112, Comp: 145123
            const idMatch = sourceUrl.match(/0+(\d+)\.0+(\d+)\.html/);
            if (idMatch) {
                // PR Times URL Logic: release_id.company_id
                sourceLinkData = { releaseId: idMatch[1], companyId: idMatch[2] };
                console.log(`   ℹ️ Source IDs - Company: ${sourceLinkData.companyId}, Release: ${sourceLinkData.releaseId}`);
            }
        }
    }

    // 2. Image Authenticity & Source Consistency Check
    const imgRegex = /<img[^>]+src="([^"]+)"/g;
    let match;
    let imgCount = 0;
    while ((match = imgRegex.exec(content)) !== null) {
        imgCount++;
        const src = match[1];
        if (src.includes('unsplash.com')) {
            errors.push(`❌ Unauthorized Stock Image detected: ${src} (Unsplash is banned)`);
        } else if (src.includes('blob:') || src.includes('data:')) {
            errors.push(`❌ Generated/Binary Image detected: ${src.substring(0, 30)}...`);
        } else if (!isAllowedDomain(src)) {
            warnings.push(`⚠️ Unknown Image Domain: ${src}. Verify if this is the original source.`);
        } else {
            // Check for ID mismatch if we have source data
            if (sourceLinkData && (src.includes('prtimes') || src.includes('fastly'))) {
                // Expected pattern in image URL: usually contains company_id somewhere

                // Allow fuzzy match (just checking if Company ID appears in URL)
                const hasComp = src.includes(sourceLinkData.companyId);

                if (!hasComp) {
                    errors.push(`❌ CONTENT MISMATCH: Image URL does not match Source Article Company ID.\n      Source Company: ${sourceLinkData.companyId}\n      Image URL: ...${src.split('/').pop().substring(0, 30)}...`);
                } else {
                    console.log(`✅ Valid & Consistent Source Image: ${src.split('/').pop().substring(0, 20)}...`);
                }
            } else {
                console.log(`✅ Valid Domain Image (No ID check possible): ${src.split('/').pop().substring(0, 20)}...`);
            }
        }
    }
    if (imgCount === 0) warnings.push("⚠️ No images found. Is this intentional?");

    // 3. Multilingual Check
    const reqLangs = ['data-en', 'data-fr', 'data-de', 'data-pt', 'data-jp'];
    const langRegex = new RegExp(reqLangs.join('|'), 'g');
    const langMatches = content.match(langRegex) || [];
    // Super simple check: do we have at least one instance of each?
    reqLangs.forEach(lang => {
        if (!content.includes(lang + "=")) {
            errors.push(`❌ Missing translation attribute: ${lang}`);
        }
    });

    // 4. Map Check
    if (!content.includes('<iframe') || !content.includes('maps.google.com')) {
        warnings.push("⚠️ No Google Maps iframe found. Please check location requirements.");
    }

    // Report
    if (errors.length > 0) {
        console.error("🚨 VALIDATION FAILED:");
        errors.forEach(e => console.error(e));
    } else {
        console.log("✨ VALIDATION PASSED");
    }
    if (warnings.length > 0) {
        console.warn("Details:");
        warnings.forEach(w => console.warn(w));
    }
}

// Run on arguments
const args = process.argv.slice(2);
if (args.length === 0) {
    console.log("Usage: node scripts/validate_article.js <html_file_path>");
    // Default test on latest gen files
    const testFiles = ['articles_gen_matcha.html', 'articles_gen_knives.html'];
    testFiles.forEach(f => {
        if (fs.existsSync(f)) validateFile(f);
    });
} else {
    args.forEach(f => validateFile(f));
}
