// Health Checker Module for Nitter Instances
// Tests instance availability and performance, with caching support

const https = require('https');
const http = require('http');

// Cache for healthy instances
let healthCache = {
    instances: [],
    timestamp: null,
    ttl: 5 * 60 * 1000 // 5 minutes
};

/**
 * Check if a single Nitter instance is healthy
 * @param {string} instance - Nitter instance domain (e.g., 'nitter.net')
 * @param {string} testHandle - Twitter handle to test with (default: 'twitter')
 * @param {number} timeout - Request timeout in milliseconds
 * @returns {Promise<{instance: string, responseTime: number} | null>}
 */
async function checkInstanceHealth(instance, testHandle = 'twitter', timeout = 5000) {
    const startTime = Date.now();
    const url = `https://${instance}/${testHandle}`;

    return new Promise((resolve) => {
        const timeoutId = setTimeout(() => {
            req.destroy();
            resolve(null);
        }, timeout);

        const req = https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            }
        }, (res) => {
            clearTimeout(timeoutId);
            let data = '';

            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const responseTime = Date.now() - startTime;

                // Check if response is valid
                if (res.statusCode === 200 && data.length > 1000 && data.includes('timeline')) {
                    resolve({ instance, responseTime });
                } else {
                    resolve(null);
                }
            });
        });

        req.on('error', () => {
            clearTimeout(timeoutId);
            resolve(null);
        });
    });
}

/**
 * Test multiple instances in parallel and return healthy ones sorted by response time
 * @param {string[]} instances - Array of instance domains to test
 * @param {number} maxToTest - Maximum number of instances to test concurrently
 * @returns {Promise<Array<{instance: string, responseTime: number}>>}
 */
async function getHealthyInstances(instances, maxToTest = 5) {
    console.log(`\n🏥 Health Checking ${Math.min(maxToTest, instances.length)} Nitter instances...`);

    // Test the first N instances in parallel
    const instancesToTest = instances.slice(0, maxToTest);
    const results = await Promise.all(
        instancesToTest.map(instance => checkInstanceHealth(instance))
    );

    // Filter out failed checks and sort by response time
    const healthyInstances = results
        .filter(result => result !== null)
        .sort((a, b) => a.responseTime - b.responseTime);

    if (healthyInstances.length > 0) {
        console.log(`✅ Found ${healthyInstances.length} healthy instance(s):`);
        healthyInstances.forEach(({ instance, responseTime }) => {
            console.log(`   • ${instance} (${responseTime}ms)`);
        });
    } else {
        console.log(`⚠️  No healthy instances found in initial check`);
    }

    return healthyInstances;
}

/**
 * Get cached healthy instances if cache is still valid, otherwise perform new health check
 * @param {string[]} instances - Array of instance domains
 * @param {number} maxToTest - Maximum instances to test if cache is invalid
 * @returns {Promise<Array<{instance: string, responseTime: number}>>}
 */
async function getCachedHealthyInstances(instances, maxToTest = 5) {
    const now = Date.now();

    // Check if cache is valid
    if (healthCache.timestamp && (now - healthCache.timestamp) < healthCache.ttl) {
        const cacheAge = Math.round((now - healthCache.timestamp) / 1000);
        console.log(`\n💾 Using cached health check results (${cacheAge}s old)`);
        return healthCache.instances;
    }

    // Cache is invalid or empty, perform new health check
    const healthyInstances = await getHealthyInstances(instances, maxToTest);

    // Update cache
    healthCache.instances = healthyInstances;
    healthCache.timestamp = now;

    return healthyInstances;
}

/**
 * Clear the health check cache
 */
function clearCache() {
    healthCache.instances = [];
    healthCache.timestamp = null;
    console.log('🗑️  Health check cache cleared');
}

// CLI testing support
if (require.main === module) {
    const testInstances = [
        'xcancel.com',
        'nitter.poast.org',
        'nitter.privacydev.net',
        'nitter.net',
        'nitter.catsarch.com'
    ];

    console.log('🧪 Testing Nitter Instance Health Checker\n');
    console.log('='.repeat(60));

    getCachedHealthyInstances(testInstances, 5).then(results => {
        console.log('\n' + '='.repeat(60));
        console.log(`\n📊 Final Results: ${results.length} healthy instances`);

        if (results.length > 0) {
            console.log('\n🎯 Recommended priority order:');
            results.forEach((result, index) => {
                console.log(`   ${index + 1}. ${result.instance} (${result.responseTime}ms)`);
            });
        } else {
            console.log('\n❌ No instances are currently available');
        }

        process.exit(results.length > 0 ? 0 : 1);
    });
}

module.exports = {
    checkInstanceHealth,
    getHealthyInstances,
    getCachedHealthyInstances,
    clearCache
};
