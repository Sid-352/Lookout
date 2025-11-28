# Lookout 🔭

A lightweight, fast Twitter/X monitoring tool that watches profiles for new tweets and sends them as formatted notifications to Discord webhooks.

**Lookout** is a modern evolution of traditional Twitter scrapers - using **Nitter** instead of direct X.com scraping for better reliability, no authentication requirements, and 10x faster performance.

## ✨ Features

- ⚡ **Lightning Fast** - Uses simple HTTP requests instead of heavy browser automation
- 🔓 **No Authentication** - Doesn't require Twitter API keys or auth tokens
- 🛡️ **Reliable** - Falls back through **15+ Nitter instances** automatically
- 🏥 **Smart Health Checking** - Pre-tests instances for availability and performance
- 🧠 **Intelligent Caching** - Remembers healthy instances for 5 minutes
- 🎯 **Smart Filtering** - Automatically ignores pinned tweets
- 📝 **Stateful** - Remembers the last tweet to prevent duplicate notifications
- 🤖 **Automated** - Two GitHub Actions workflows for scheduled and manual operation
- 💬 **Rich Embeds** - Posts formatted Discord embeds with profile pictures, images, and metadata
- 🚨 **Smart Error Detection** - Distinguishes rate limits, timeouts, and instance failures

## 🚀 How It Works

```
Health Check → Nitter Instance → Parse HTML → Check if New → Post to Discord → Save State
```

**New in v2.1:** Health checking system
1. **Pre-flight Check**: Tests top 5 instances before scraping (~5 seconds)
2. **Smart Caching**: Remembers healthy instances for 5 minutes
3. **Priority Queue**: Tries healthy instances first, then falls back to all instances
4. **Error Detection**: Identifies rate limits, timeouts, and instance failures

Unlike traditional scrapers that use Playwright to scrape X.com directly:
- **No browser needed** - Just simple HTTPS requests
- **No cookies/tokens** - Nitter proxies the content
- **Much faster** - ~2 seconds vs ~30 seconds per check
- **More stable** - Simpler HTML structure

## 📦 Setup & Configuration

### 1. Clone & Install

```bash
git clone https://github.com/yourusername/Lookout.git
cd Lookout
npm install
```

### 2. Environment Variables

Create a `.env` file in the root directory:

```env
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/your-webhook-url
```

#### Getting Your Discord Webhook URL

1. In Discord, go to **Server Settings** → **Integrations** → **Webhooks**
2. Click **New Webhook**
3. Choose the channel where you want notifications
4. Copy the **Webhook URL**
5. Paste it into your `.env` file

### 3. GitHub Secrets (for Actions)

If using GitHub Actions, add your webhook URL as a secret:

1. Go to your repo → **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Name: `DISCORD_WEBHOOK_URL`
4. Value: Your webhook URL

## 🎮 Usage

### Local Testing

```bash
# Check a specific handle
node scraper.js DarkSoulsGame

# Or use npm start with handle as argument
npm start eldenring
```

### GitHub Actions

**Scheduled Run** (every 12 hours):
- Automatically runs via the `scheduled_fetch.yml` workflow
- Currently monitors `@DarkSoulsGame`
- Edit the workflow to change the handle

**Manual Run** (on-demand):
1. Go to **Actions** tab in your repo
2. Click **Manual Tweet Fetch**
3. Click **Run workflow**
4. Enter the Twitter handle (without @)
5. Click **Run workflow** again

## 🏗️ Architecture

### File Structure

```
Lookout/
├── scraper.js              # Main scraper logic
├── package.json            # Dependencies (just discord.js + dotenv!)
├── .env                    # Environment variables (local only)
├── log/                    # Stores last tweet URL for each handle
│   └── {handle}_last_tweet.txt
└── .github/workflows/
    ├── scheduled_fetch.yml # Runs every 12 hours
    └── manual_fetch.yml    # Manual on-demand runs
```

### Nitter Instance Fallback Chain

Lookout tries these Nitter instances in order (now with **15+ instances**):

**Tier 1: Most Reliable**
1. `xcancel.com`
2. `nitter.poast.org`

**Tier 2: Generally Stable**
3. `nitter.privacydev.net`
4. `nitter.net`
5. `nitter.catsarch.com`

**Tier 3: Backup Instances**
6. `nitter.woodland.cafe`
7. `nitter.in.projectsegfau.lt`
8. `nitter.1d4.us`
9. `nitter.moomoo.me`
10. And 5 more...

The **health checker** runs before each scrape to find the fastest working instances. If all fail, it sends an error notification to Discord.

### Health Checking

The health checker module (`healthChecker.js`) can be run standalone:

```bash
node healthChecker.js
```

This will:
- Test the top 5 instances in parallel
- Show response times
- Cache results for 5 minutes
- Return instances sorted by speed

## 🔧 Configuration

### Monitoring Multiple Handles

Edit `.github/workflows/scheduled_fetch.yml`:

```yaml
- name: Run Lookout for Multiple Handles
  run: |
    node scraper.js DarkSoulsGame
    node scraper.js eldenring
    node scraper.js fromsoftware_pr
  env:
    DISCORD_WEBHOOK_URL: ${{ secrets.DISCORD_WEBHOOK_URL }}
```

### Changing Schedule

Edit the cron expression in `scheduled_fetch.yml`:

```yaml
schedule:
  - cron: '0 */12 * * *'  # Every 12 hours
  # - cron: '0 * * * *'   # Every hour
  # - cron: '*/30 * * * *' # Every 30 minutes
```

### Adding More Nitter Instances

Edit the `NITTER_INSTANCES` array in `scraper.js`:

```javascript
const NITTER_INSTANCES = [
  'xcancel.com',
  'nitter.poast.org',
  'your-custom-instance.com',
  // Add more instances here
];
```

## 🐛 Troubleshooting

### No Tweets Being Posted

1. **Check Nitter health**: Run `node healthChecker.js` to see which instances are working
2. **Test manually**: Run `node scraper.js <handle>` locally to see detailed logs
3. **Check Discord webhook**: Make sure the URL is correct in `.env`
4. **Check GitHub Actions logs**: Look for error messages in the Actions tab

### "All Nitter instances failed"

The error message will show a breakdown of failure types:
- **RATE_LIMIT**: Instance is blocking requests (common)
- **TIMEOUT**: Instance is slow or unresponsive
- **INSTANCE_DOWN**: Instance server is offline
- **CONTENT_MISSING**: Instance is up but content not loading

**Solutions:**
- Wait 10-15 minutes and try again (rate limits usually reset)
- The scraper automatically tries all 15+ instances, so this is rare
- Check if the Twitter handle exists and has public tweets
- Run `node healthChecker.js` to verify instance availability

| Feature | Old (Playwright) | New (Nitter) |
|---------|------------------|--------------|
| **Speed** | ~30 seconds | ~2 seconds |
| **Dependencies** | ~400MB (Playwright browsers) | ~5MB |
| **Auth Required** | Yes (auth_token cookie) | No |
| **Reliability** | Breaks when X changes DOM | More stable |
| **Resource Usage** | High (headless browser) | Minimal (HTTP requests) |
| **Maintenance** | Complex selectors | Simple HTML parsing |

## 🐛 Troubleshooting

### No Tweets Being Posted

1. **Check if Nitter instances are up**: Visit https://status.d420.de
2. **Test manually**: Run `node scraper.js <handle>` locally
3. **Check Discord webhook**: Make sure the URL is correct in `.env`

### "All Nitter instances failed"

- Nitter instances may be temporarily down
- Try adding more instances to the fallback list
- Check if the Twitter handle exists and has public tweets

### Old Tweets Being Reposted

- Delete the log file: `log/{handle}_last_tweet.txt`
- The next run will treat the latest tweet as "new"

### Health Check Taking Too Long

- First run takes ~20-30 seconds to check instances
- Subsequent runs within 5 minutes use cached results (~2-5 seconds)
- You can adjust `HEALTH_CHECK_COUNT` in `scraper.js` to test fewer instances

## 📊 Example Output

```
🔭 Lookout v2.0 - Monitoring @DarkSoulsGame
============================================================

🏥 Health Checking 5 Nitter instances...
✅ Found 3 healthy instance(s):
   • xcancel.com (243ms)
   • nitter.poast.org (387ms)
   • nitter.net (521ms)

🎯 Will try 15 instances (3 pre-checked)

🔍 Trying xcancel.com...
   ⚡ Parsing HTML (fast mode)...
✅ Success with HTTP from xcancel.com!

============================================================
🆕 NEW TWEET DETECTED!
============================================================
👤 Author: Dark Souls (@DarkSoulsGame)
📝 Text: Prepare to face the darkness once more...
🔗 URL: https://twitter.com/DarkSoulsGame/status/987654321
🖼️  Image: Yes
============================================================

📤 Sending tweet from @DarkSoulsGame to Discord...
✅ Successfully sent to Discord!

💾 Updating log file...

✅ DONE!
```

## 🤝 Contributing

Feel free to open issues or submit PRs! Some ideas:

- Add support for multiple images in a tweet
- Handle video content better
- Add support for threads/quote tweets
- Create a config file for multiple handles
- Add more Nitter instances

## 📜 License

ISC License - see [LICENSE](LICENSE)

## 🙏 Credits

- Built on top of [Overseer](https://github.com/Sid-352/Overseer) by Sid-352
- Uses [Nitter](https://github.com/zedeus/nitter) instances for Twitter access
- Powered by [discord.js](https://discord.js.org/)

## ⚠️ Disclaimer

This tool uses public Nitter instances to access Twitter content. It's intended for personal use and monitoring public Twitter accounts. Be respectful of rate limits and don't abuse the service.

---

**Made with 🔭 for keeping watch on your favorite Twitter accounts**
