#!/usr/bin/env python3
"""
Lookout v3.0 - Twitter Monitor using ntscraper
Simplified, faster, more reliable than Playwright approach
"""

import os
import sys
import json
from pathlib import Path
from ntscraper import Nitter
import requests
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def send_to_discord(webhook_url, tweet_data):
    """Send tweet to Discord webhook"""
    
    embed = {
        "color": 0x1DA1F2,  # Twitter blue
        "author": {
            "name": f"{tweet_data['author']} • @{tweet_data['handle']}",
            "url": tweet_data['link']
        },
        "description": tweet_data['text'],
        "timestamp": tweet_data.get('date', ''),
        "footer": {
            "text": "🔭 Lookout v3.0"
        }
    }
    
    # Add image if present
    if tweet_data.get('pictures'):
        embed["image"] = {"url": tweet_data['pictures'][0]}
    
    payload = {
        "username": "Lookout",
        "embeds": [embed]
    }
    
    response = requests.post(webhook_url, json=payload)
    response.raise_for_status()
    return response.status_code

def get_latest_tweet(handle):
    """Fetch latest tweet using ntscraper"""
    print(f"\n{'='*60}")
    print(f"🔭 LOOKOUT v3.0 - Monitoring @{handle}")
    print('='*60)
    
    scraper = Nitter()
    
    print(f"\n🔍 Fetching latest tweet from @{handle}...")
    
    try:
        tweets = scraper.get_tweets(handle, mode='user', number=1)
        
        if not tweets or 'tweets' not in tweets or not tweets['tweets']:
            raise Exception("No tweets found")
        
        latest = tweets['tweets'][0]
        
        print(f"✅ Found tweet!")
        print(f"   Text: {latest['text'][:60]}...")
        print(f"   Link: {latest['link']}")
        
        return latest
        
    except Exception as e:
        print(f"❌ Error fetching tweet: {e}")
        raise

def main():
    if len(sys.argv) < 2:
        print("❌ Error: No Twitter handle provided")
        print("Usage: python scraper.py <handle>")
        sys.exit(1)
    
    handle = sys.argv[1]
    
    # Setup paths
    log_dir = Path("log")
    log_dir.mkdir(exist_ok=True)
    log_file = log_dir / f"{handle}_last_tweet.txt"
    
    # Read last posted URL
    last_posted_url = ""
    if log_file.exists():
        last_posted_url = log_file.read_text().strip()
        print(f"📝 Last posted URL: {last_posted_url}")
    else:
        print("📝 No previous log found. This is the first run.")
    
    try:
        # Fetch latest tweet
        tweet = get_latest_tweet(handle)
        tweet_url = tweet['link']
        
        # Check if it's new
        if tweet_url == last_posted_url:
            print("\n✓ No new tweet found. Exiting.")
            return
        
        print(f"\n{'='*60}")
        print("🆕 NEW TWEET DETECTED!")
        print('='*60)
        print(f"👤 Author: {tweet.get('author', 'Unknown')}")
        print(f"📝 Text: {tweet['text'][:200]}{'...' if len(tweet['text']) > 200 else ''}")
        print(f"🔗 URL: {tweet_url}")
        print(f"🖼️  Images: {len(tweet.get('pictures', []))}")
        print('='*60)
        
        # Send to Discord
        webhook_url = os.getenv('DISCORD_WEBHOOK_URL')
        if not webhook_url:
            print("\n⚠️  Warning: DISCORD_WEBHOOK_URL not set in .env file")
            print("Skipping Discord notification.")
        else:
            print(f"\n📤 Sending tweet to Discord...")
            status = send_to_discord(webhook_url, tweet)
            print(f"✅ Successfully sent to Discord! (HTTP {status})")
        
        # Update log file
        print(f"\n💾 Updating log file...")
        log_file.write_text(tweet_url)
        
        print("\n✅ DONE!\n")
        
    except Exception as e:
        print(f"\n{'='*60}")
        print(f"❌ ERROR for @{handle}")
        print('='*60)
        print(str(e))
        print('='*60 + '\n')
        sys.exit(1)

if __name__ == "__main__":
    main()
