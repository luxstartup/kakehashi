const fs = require('fs');
const path = require('path');

// Configuration
const STRATEGY_FILE = path.join(__dirname, '../docs/weekly_content_strategy.md');
const TEMPLATE_FILE = path.join(__dirname, '../docs/ai_content_generation_instructions.md');
const OUTPUT_DIR = path.join(__dirname, '../prompts');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR);
}

// 1. Read the Strategy File
console.log(`Reading strategy file: ${STRATEGY_FILE}`);
if (!fs.existsSync(STRATEGY_FILE)) {
    console.error("Error: Strategy file not found.");
    process.exit(1);
}
const strategyContent = fs.readFileSync(STRATEGY_FILE, 'utf-8');

// 2. Read the Template File
console.log(`Reading template file: ${TEMPLATE_FILE}`);
if (!fs.existsSync(TEMPLATE_FILE)) {
    console.error("Error: Template file not found.");
    process.exit(1);
}
const templateContent = fs.readFileSync(TEMPLATE_FILE, 'utf-8');

// 3. Extract URLs
// Regex to find http/https URLs. 
// We exclude common markdown syntax wrapping like ) or ] at the end.
const urlRegex = /https?:\/\/[^\s)"]+/g;
const foundUrls = strategyContent.match(urlRegex) || [];

// Filter out URLs that are likely general resource links (optional, can be refined)
// For now, we process all found URLs.
console.log(`Found ${foundUrls.length} URLs in the strategy document.`);

if (foundUrls.length === 0) {
    console.log("No URLs found. Please add article URLs to weekly_content_strategy.md to generate prompts.");
    process.exit(0);
}

// 4. Generate Prompts
foundUrls.forEach((url, index) => {
    // Basic cleanup of URL (remove trailing symbols if regex caught them)
    const cleanUrl = url.replace(/[)]$/, '');

    console.log(`Processing URL [${index + 1}/${foundUrls.length}]: ${cleanUrl}`);

    // Replace placeholder in template
    // The placeholder in the file is `{対象のURL}`
    let promptContent = templateContent.replace('{対象のURL}', cleanUrl);

    // Also try to replace the markdown placeholder if it exists in a code block slightly differently, 
    // but the instruction file uses exactly `{対象のURL}`.

    // Create a filename based on the URL or index
    const filename = `prompt_${index + 1}_${cleanUrl.split('/').pop().substring(0, 20).replace(/[^a-zA-Z0-9]/g, '_')}.md`;
    const outputPath = path.join(OUTPUT_DIR, filename);

    fs.writeFileSync(outputPath, promptContent, 'utf-8');
    console.log(`  -> Saved to: ${outputPath}`);
});

console.log("\nDone! Copy the content of the generated files in 'prompts/' to your AI tool.");
