const puppeteer = require('puppeteer');

(async () => {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  const url = 'https://trans4mers-547808710111.us-central1.run.app';
  console.log(`Navigating to ${url}...`);
  await page.goto(url, { waitUntil: 'networkidle2' });
  
  console.log('Testing App Title...');
  const title = await page.title();
  console.log(`Title: ${title}`);
  
  console.log('Testing Project Creation...');
  // Wait for "New Project" button (assuming it exists on the landing page)
  try {
    await page.waitForSelector('button, a', { timeout: 5000 });
    // This is a naive attempt; in a real script we would target specific IDs or texts
    // Let's just dump the body text to verify it loaded.
    const bodyText = await page.evaluate(() => document.body.innerText);
    console.log(`Body text snippet: ${bodyText.substring(0, 200)}...`);
    
    // We can also test API endpoints directly
    console.log('Testing API /api/workspace/projects...');
    const apiResponse = await page.evaluate(async () => {
      try {
        const res = await fetch('/api/workspace/projects');
        return await res.json();
      } catch(e) {
        return e.toString();
      }
    });
    console.log(`API response:`, apiResponse);
    
  } catch(e) {
    console.error('Error during testing:', e);
  }
  
  await browser.close();
  console.log('Test complete!');
})();
