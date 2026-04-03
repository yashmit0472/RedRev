// Uses Node.js built-in fetch (v18+) — NOT node-fetch
// node-fetch gets blocked by Reddit's TLS fingerprint detection

// Common filler words that match too many unrelated products
const STOPWORDS = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'is', 'it', 'this', 'that', 'from', 'as', 'are',
    'was', 'were', 'be', 'been', 'has', 'have', 'had', 'do', 'does', 'did',
    'will', 'can', 'may', 'not', 'no', 'so', 'if', 'my', 'your', 'our',
    'new', 'best', 'good', 'great', 'top', 'buy', 'get', 'got',
    'edition', 'version', 'series', 'model', 'gen', 'generation',
    'black', 'white', 'blue', 'red', 'green', 'gold', 'silver', 'grey', 'gray',
    'with', 'without'
]);

function extractProductIdentity(title) {
    const cleaned = title
        .toLowerCase()
        .replace(/\(.*?\)/g, '')        // remove parenthetical info like (Black, 128GB)
        .replace(/,.*$/g, '')           // remove everything after first comma
        .replace(/[^a-z0-9 ]/g, ' ')   // symbols to spaces
        .split(/\s+/)
        .filter(w => w.length > 1 && !STOPWORDS.has(w));

    // Identify brand (first meaningful word) and model keywords
    const brand = cleaned[0] || '';
    const modelWords = cleaned.slice(0, 3); // brand + up to 2 model words

    return { brand, modelWords, fullClean: modelWords.join(' ') };
}

function scoreRelevance(post, brand, modelWords) {
    const content = (post.title + ' ' + post.text).toLowerCase();

    let score = 0;

    // Brand match is critical (worth 3 points)
    if (content.includes(brand)) score += 3;

    // Each model word match is worth 1 point
    for (const word of modelWords) {
        if (word !== brand && content.includes(word)) score += 1;
    }

    // Check for the full product name as a phrase (bonus 5 points)
    const phrase = modelWords.join(' ');
    if (content.includes(phrase)) score += 5;

    // Penalize very short content (likely just a link post)
    if (content.length < 50) score -= 2;

    // Bonus for posts with actual text body (not just title)
    if (post.text.length > 100) score += 1;

    return score;
}

async function getRedditPosts(query) {
    try {
        const { brand, modelWords, fullClean } = extractProductIdentity(query);

        if (!brand) {
            console.log('❌ Could not extract brand from title');
            return [];
        }

        console.log(`🔍 Brand: "${brand}", Model: "${modelWords.join(' ')}"`);

        // Strategy: Run two searches — one quoted (exact), one unquoted (broad)
        // Then merge and deduplicate
        const searches = [
            `"${fullClean}" review`,             // exact match
            `${brand} ${modelWords.slice(1).join(' ')} review`,  // broad match
            `${brand} ${modelWords[1] || ''} review` // very broad fallback
        ];

        let allPosts = [];

        for (const searchQuery of searches) {
            const url = `https://api.reddit.com/search?q=${encodeURIComponent(
                searchQuery
            )}&limit=25&sort=relevance&t=all`;

            console.log('🔗 Reddit search:', searchQuery);

            const res = await fetch(url, {
                headers: { 'User-Agent': 'RedRevBot/1.0' }
            });

            if (!res.ok) {
                console.error(`❌ Reddit returned ${res.status} for: ${searchQuery}`);
                continue;
            }

            const data = await res.json();

            if (!data?.data?.children) continue;

            const posts = data.data.children.map(p => ({
                title: p.data.title || '',
                text: p.data.selftext || '',
                upvotes: p.data.ups || 0,
                subreddit: p.data.subreddit || ''
            }));

            allPosts.push(...posts);
        }

        // Deduplicate by title
        const seen = new Set();
        allPosts = allPosts.filter(p => {
            const key = p.title.toLowerCase().trim();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        // Score and filter posts by relevance
        let scored = allPosts.map(p => ({
            ...p,
            relevance: scoreRelevance(p, brand, modelWords)
        }));

        // Must at least contain the brand name AND have a minimum relevance
        const minRelevance = modelWords.length > 1 ? 4 : 3;
        scored = scored.filter(p => {
            const content = (p.title + ' ' + p.text).toLowerCase();
            return content.includes(brand) && p.relevance >= minRelevance;
        });

        // Sort by relevance first, then upvotes as tiebreaker
        scored.sort((a, b) => {
            if (b.relevance !== a.relevance) return b.relevance - a.relevance;
            return b.upvotes - a.upvotes;
        });

        const results = scored.slice(0, 5).map(({ relevance, ...post }) => post);

        console.log(`✅ Reddit found ${scored.length} relevant posts, returning top ${results.length}`);
        results.forEach((p, i) => console.log(`   ${i + 1}. [${p.upvotes}↑] ${p.title.substring(0, 70)}`));

        return results;

    } catch (err) {
        console.error('❌ Reddit error:', err.message);
        return [];
    }
}

module.exports = { getRedditPosts };