// Lookout v2.1 - Nitter Scraper with Playwright
const { chromium } = require('playwright');
const { WebhookClient, EmbedBuilder } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');
const { getCachedHealthyInstances } = require('./healthChecker');
require('dotenv').config();

// ============================================================================
// CONFIGURATION  
// ============================================================================

// Nitter instances to try (priority order)
const NITTER_INSTANCES = [
  'nitter.net',            // Original, currently working
  'xcancel.com',
  'nitter.poast.org',
  'nitter.privacydev.net',
  'nitter.catsarch.com',
  'nitter.woodland.cafe',
  'nitter.in.projectsegfau.lt',
  'nitter.1d4.us',
  'nitter.moomoo.me',
  'nitter.eu.projectsegfau.lt',
  'nitter.projectsegfau.lt',
  'nitter.fdn.fr',
  'nitter.ktachibana.party',
  'nitter.pw'
];

const PLAYWRIGHT_TIMEOUT = 30000;  // 30 seconds
const HEALTH_CHECK_COUNT = 3;      // Check top 3 instances

// ============================================================================
// SCRAPING FUNCTION
// ============================================================================

async function scrapeNitterInstance(instance, handle) {
  console.log(`\n🔍 Trying ${instance}...`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    const page = await context.newPage();
    const url = `https://${instance}/${handle}`;

    console.log(`   Navigating to ${url}...`);
    await page.goto(url, {
      timeout: PLAYWRIGHT_TIMEOUT,
      waitUntil: 'networkidle'
    });

    // Wait a moment for dynamic content
    await page.waitForTimeout(2000);

    console.log(`   Looking for tweets...`);

    // Find all tweet status links
    const statusLinks = await page.$$eval('a[href*="/status/"]', links =>
      links.map(link => link.href || link.getAttribute('href'))
    );

    if (statusLinks.length === 0) {
      throw new Error('No tweet links found on page');
    }

    console.log(`   Found ${statusLinks.length} tweet links`);

    // Get first tweet URL (skip checking for pinned - just get the latest)
    // We'll handle pinned tweets by checking the URL against our log
    const firstTweetLink = statusLinks[0];
    const tweetUrl = firstTweetLink.startsWith('http')
      ? firstTweetLink
      : `https://twitter.com${firstTweetLink}`;

    console.log(`   Latest tweet: ${tweetUrl}`);

    // Extract author info from page
    const authorName = await page.$eval(
      'a.fullname, .fullname',
      el => el.textContent.trim()
    ).catch(() => 'Unknown');

    const authorHandle = await page.$eval(
      'a.username, .username',
      el => el.textContent.trim()
    ).catch(() => '@unknown');

    // Get profile pic
    const profilePicUrl = await page.$eval(
      'img.avatar, .avatar img',
      el => el.src || el.getAttribute('src')
    ).catch(() => '');

    // Get tweet text (first one on page)
    const tweetText = await page.$eval(
      '.tweet-content',
      el => el.textContent.trim()
    ).catch(() => 'Tweet content unavailable');

    // Get timestamp (use current time if Nitter doesn't provide valid one)
    let timestamp = new Date().toISOString();
    try {
      const timeAttr = await page.$eval(
        '.tweet-date a, a[title]',
        el => el.getAttribute('title')
      );
      // Validate it's a real date before using it
      if (timeAttr && !isNaN(Date.parse(timeAttr))) {
        timestamp = timeAttr;
      }
    } catch (e) {
      // Use default current time
    }

    // Get image if present
    const tweetImageUrl = await page.$eval(
      '.still-image, .attachment img',
      el => el.src || el.getAttribute('src')
    ).catch(() => null);

    // Fix relative URLs for profile pic and images
    const fixedProfilePic = profilePicUrl && profilePicUrl.startsWith('/')
      ? `https://${instance}${profilePicUrl}`
      : profilePicUrl;

    const fixedImageUrl = tweetImageUrl && tweetImageUrl.startsWith('/')
      ? `https://${instance}${tweetImageUrl}`
      : tweetImageUrl;

    console.log(`✅ Successfully scraped from ${instance}!`);

    return {
      tweetUrl,
      authorName,
      authorHandle,
      tweetText,
      timestamp,
      profilePicUrl: fixedProfilePic,
      tweetImageUrl: fixedImageUrl,
      handle,
      nitterInstance: instance
    };

  } finally {
    await browser.close();
  }
}

// ============================================================================
// INSTANCE SELECTION & FALLBACK
// ============================================================================

async function fetchLatestTweet(handle) {
  // Get healthy instances
  const healthyInstances = await getCachedHealthyInstances(NITTER_INSTANCES, HEALTH_CHECK_COUNT);

  // Prioritize healthy instances, then try all
  const healthyDomains = healthyInstances.map(h => h.instance);
  const fallbackInstances = NITTER_INSTANCES.filter(i => !healthyDomains.includes(i));
  const instancesToTry = [...healthyDomains, ...fallbackInstances];

  console.log(`\n🎯 Will try ${instancesToTry.length} instances (${healthyDomains.length} pre-checked healthy)\n`);

  let lastError = null;

  for (const instance of instancesToTry) {
    try {
      const tweetData = await scrapeNitterInstance(instance, handle);
      return tweetData;
    } catch (error) {
      console.log(`   ❌ ${instance} failed: ${error.message}`);
      lastError = error;
    }
  }

  throw new Error(`All ${instancesToTry.length} Nitter instances failed. Last error: ${lastError?.message}`);
}

// ============================================================================
// DISCORD WEBHOOK
// ============================================================================

async function sendToDiscord(tweetData) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    console.error('Error: DISCORD_WEBHOOK_URL is not set in the .env file.');
    return;
  }

  const webhookClient = new WebhookClient({ url: webhookUrl });
  const embed = new EmbedBuilder()
    .setColor(0x1DA1F2)
    .setAuthor({
      name: `${tweetData.authorName} • ${tweetData.authorHandle}`,
      iconURL: tweetData.profilePicUrl,
      url: tweetData.tweetUrl
    })
    .setDescription(tweetData.tweetText)
    .setTimestamp(new Date(tweetData.timestamp))
    .setFooter({ text: `🔭 Lookout via ${tweetData.nitterInstance}` });

  if (tweetData.tweetImageUrl) {
    embed.setImage(tweetData.tweetImageUrl);
  }

  console.log(`\n📤 Sending tweet from @${tweetData.handle} to Discord...`);
  try {
    await webhookClient.send({
      username: 'Lookout',
      avatarURL: tweetData.profilePicUrl,
      embeds: [embed],
    });
    console.log('✅ Successfully sent to Discord!');
  } catch (error) {
    console.error('❌ Error sending to Discord:', error.message);
    throw error;
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const handle = process.argv[2];
  if (!handle) {
    console.error('❌ Error: No Twitter handle provided. Usage: node scraper.js <handle>');
    return;
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`🔭 LOOKOUT v2.1 - Monitoring @${handle}`);
  console.log(`${'='.repeat(60)}\n`);

  const logFilePath = path.join(__dirname, 'log', `${handle}_last_tweet.txt`);

  // Read last posted tweet URL
  let lastPostedUrl = '';
  try {
    lastPostedUrl = await fs.readFile(logFilePath, 'utf-8');
    console.log(`📝 Last posted URL: ${lastPostedUrl}`);
  } catch (error) {
    console.log('📝 No previous log found. This is the first run.');
  }

  try {
    // Fetch latest tweet from Nitter
    const tweetData = await fetchLatestTweet(handle);

    // Check if it's a new tweet
    if (tweetData.tweetUrl === lastPostedUrl) {
      console.log('\n✓ No new tweet found. Exiting.');
      return;
    }

    console.log('\n' + '='.repeat(60));
    console.log('🆕 NEW TWEET DETECTED!');
    console.log('='.repeat(60));
    console.log(`👤 Author: ${tweetData.authorName} (${tweetData.authorHandle})`);
    console.log(`📝 Text: ${tweetData.tweetText.substring(0, 200)}${tweetData.tweetText.length > 200 ? '...' : ''}`);
    console.log(`🔗 URL: ${tweetData.tweetUrl}`);
    console.log(`🖼️  Image: ${tweetData.tweetImageUrl ? 'Yes' : 'No'}`);
    console.log('='.repeat(60));

    // Send to Discord
    await sendToDiscord(tweetData);

    // Update log file
    console.log(`\n💾 Updating log file...`);
    await fs.mkdir(path.dirname(logFilePath), { recursive: true });
    await fs.writeFile(logFilePath, tweetData.tweetUrl);

    console.log('\n✅ DONE!\n');

  } catch (error) {
    console.error(`\n${'='.repeat(60)}`);
    console.error(`❌ ERROR for @${handle}`);
    console.error(`${'='.repeat(60)}`);
    console.error(error.message);
    console.error('='.repeat(60) + '\n');
    process.exit(1);
  }
}

main();
