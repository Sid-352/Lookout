# Oracle Cloud Free Tier + Nitter Setup Guide

## Complete step-by-step guide to host your own Nitter instance on Oracle Cloud (Free Forever!)

---

## Part 1: Oracle Cloud Account Setup

### Step 1: Sign Up for Oracle Cloud
1. Go to https://www.oracle.com/cloud/free/
2. Click "Start for free"
3. Fill in details (needs credit card for verification but **won't charge**)
4. Verify email and complete setup

### Step 2: Create a VM Instance (Always Free)

1. **Log into Oracle Cloud Console**
   - https://cloud.oracle.com/

2. **Create Compute Instance**
   - Click **☰** menu → **Compute** → **Instances**
   - Click **"Create Instance"**

3. **Configure Instance** (Important - stay in free tier):
   ```
   Name: nitter-server
   Compartment: (root)
   
   Image: Ubuntu 22.04 (Minimal)
   Shape: VM.Standard.E2.1.Micro (Always Free - 1GB RAM)
   
   Networking:
   - Create new VCN: nitter-vcn
   - Create new subnet: public subnet
   - Assign public IP: Yes ✓
   
   SSH Keys:
   - Generate SSH key pair → Download private + public keys
   (SAVE THESE! You'll need them to connect)
   ```

4. **Click "Create"** - VM takes ~2 minutes to provision

5. **Note Your Public IP**
   - Once instance is **Running**, copy the **Public IP Address**
   - Example: `123.456.789.10`

---

## Part 2: Configure Firewall

### Open Ports for Nitter

1. **In Oracle Cloud Console**:
   - Go to your instance → **Subnet** → **Default Security List**
   - Click **"Add Ingress Rules"**

2. **Add Rule for Nitter**:
   ```
   Source CIDR: 0.0.0.0/0
   IP Protocol: TCP
   Destination Port Range: 8080
   Description: Nitter web interface
   ```

3. **Save** the rule

---

## Part 3: Connect to Your VM

### On Windows (PowerShell):

```powershell
# Navigate to where you saved the private key
cd C:\Users\YourName\Downloads

# Set permissions (if needed)
icacls ssh-key-*.key /inheritance:r
icacls ssh-key-*.key /grant:r "%USERNAME%:R"

# Connect via SSH
ssh -i ssh-key-*.key ubuntu@YOUR_PUBLIC_IP
```

**First time**: Type `yes` when asked about fingerprint

---

## Part 4: Install Docker on VM

Once connected to your VM via SSH:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add your user to docker group
sudo usermod -aG docker ubuntu

# Verify Docker is running
sudo systemctl enable docker
sudo systemctl start docker

# Test Docker
docker --version
```

---

## Part 5: Deploy Nitter

### Option A: Simple Single Container (Recommended)

```bash
# Create a directory for Nitter config
mkdir -p ~/nitter
cd ~/nitter

# Create basic nitter.conf
cat > nitter.conf << 'EOF'
[Server]
hostname = "0.0.0.0"
port = 8080
https = false
hmacKey = "secretkey123"  # Change this to something random

[Cache]
listMinutes = 240
rssMinutes = 10
redisHost = "localhost"
redisPort = 6379
redisPassword = ""
redisConnections = 20
redisMaxConnections = 30
EOF

# Run Redis (required by Nitter)
docker run -d \
  --name nitter-redis \
  --restart unless-stopped \
  redis:alpine

# Run Nitter
docker run -d \
  --name nitter \
  --restart unless-stopped \
  -p 8080:8080 \
  -v ~/nitter/nitter.conf:/src/nitter.conf:ro \
  --link nitter-redis:redis \
  zedeus/nitter:latest

# Check if it's running
docker ps
```

### Option B: Docker Compose (Alternative)

```bash
# Install Docker Compose
sudo apt install docker-compose -y

# Clone Nitter repo
git clone https://github.com/zedeus/nitter
cd nitter

# Edit config
cp nitter.example.conf nitter.conf
nano nitter.conf  # Change hostname to 0.0.0.0, port to 8080

# Start with Docker Compose
docker-compose up -d

# Check logs
docker-compose logs -f
```

---

## Part 6: Configure Ubuntu Firewall

```bash
# Allow port 8080
sudo ufw allow 8080/tcp

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

---

## Part 7: Test Your Nitter Instance

### From Your Browser:

Visit: `http://YOUR_PUBLIC_IP:8080`

You should see the Nitter homepage! 🎉

**Test with a profile**: `http://YOUR_PUBLIC_IP:8080/elonmusk`

---

## Part 8: Update Your Lookout Scraper

### Update `scraper.js`:

```javascript
const NITTER_INSTANCES = [
  'YOUR_PUBLIC_IP:8080',      // Your private Oracle instance - Always works!
  'nitter.catsarch.com',      // Backup public instance
  'nitter.net',               // Backup
  'xcancel.com',              // Backup
  // ... other backups
];
```

### Test Locally:

```powershell
# Clear log to force new scrape
Remove-Item log\DarkSoulsGame_last_tweet.txt -ErrorAction SilentlyContinue

# Test scraper
node scraper.js DarkSoulsGame
```

**Expected output**:
```
🔍 Trying YOUR_PUBLIC_IP:8080...
   Found 52 tweet links
✅ Successfully scraped from YOUR_PUBLIC_IP:8080!
```

---

## Part 9: Push to GitHub

Your GitHub Actions will now use your private Nitter instance!

```powershell
# Stage changes
git add scraper.js

# Commit
git commit -m "Add private Oracle Cloud Nitter instance"

# Push
git push origin main
```

GitHub Actions will now:
1. Run every 12 hours
2. Use YOUR Nitter instance first
3. Fall back to public instances if needed
4. Send tweets to Discord

---

## Maintenance

### Check if Nitter is Running:

```bash
ssh -i ssh-key-*.key ubuntu@YOUR_PUBLIC_IP
docker ps

# Should see:
# nitter (running)
# nitter-redis (running)
```

### Restart Nitter:

```bash
docker restart nitter
docker restart nitter-redis
```

### View Logs:

```bash
docker logs nitter
docker logs nitter-redis
```

### Update Nitter:

```bash
docker pull zedeus/nitter:latest
docker stop nitter
docker rm nitter

# Re-run the docker run command from Part 5
```

---

## Oracle Cloud Free Tier Limits

**What you get FREE FOREVER**:
- ✅ 2 VM.Standard.E2.1.Micro instances (1 OCPU, 1GB RAM each)
- ✅ 10 TB outbound data transfer/month
- ✅ 2 Block Volumes (100GB total)
- ✅ No time limit (as long as you log in once per 3 months)

**Your current usage**: 
- 1 VM for Nitter (perfectly within free tier!)
- Still have 1 VM available for other projects

---

## Troubleshooting

### Can't connect to VM via SSH?
- Check you're using the correct private key
- Verify Public IP is correct
- Check Oracle Cloud firewall rules allow port 22

### Can't access Nitter web interface?
- Verify port 8080 is open in Oracle Security List
- Check Ubuntu firewall: `sudo ufw status`
- Ensure Docker containers are running: `docker ps`

### Nitter not showing tweets?
- Check Redis is running: `docker ps | grep redis`
- Restart both containers: `docker restart nitter-redis nitter`
- Check logs: `docker logs nitter`

### Oracle marked instance as "idle" and stopped it?
- Oracle may reclaim "idle" free instances
- Log into Oracle Cloud Console once every 1-2 months
- Keep instance active by using it regularly

---

## Cost Breakdown

**Total Cost**: $0.00/month (Forever!)

**What you're getting**:
- Private Nitter instance (always available)
- No rate limits
- Full control
- No reliance on public instances

**Compared to**:
- DigitalOcean: $5/month ($60/year)
- AWS t2.micro: Free for 12 months, then ~$8/month
- Your PC running 24/7: ~$5-10/month in electricity

---

## Next Steps

Once you complete this setup:

1. ✅ Your Oracle Nitter is running 24/7
2. ✅ Your Lookout scraper uses it first
3. ✅ GitHub Actions runs on schedule
4. ✅ Discord gets notifications
5. ✅ Zero ongoing costs

**You're done! The perfect setup! 🎉**
