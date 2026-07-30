// Uses Node.js built-in fetch (v18+) — NOT node-fetch.
// Reddit's public JSON search endpoint can return 403; RSS/Atom still works
// for public search without OAuth.
const cheerio = require('cheerio');
const xml2js = require('xml2js');

const REDDIT_HEADERS = {
    'User-Agent': 'Mozilla/5.0 RedRev/1.0',
    'Accept': 'application/rss+xml,text/xml,application/json;q=0.9,*/*;q=0.8'
};

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

function normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function extractTextFromHtml(html) {
    if (!html) return '';

    const $ = cheerio.load(html);
    return normalizeText($.text());
}

function extractSubreddit(entry, contentText) {
    const linkHref = entry?.link?.$?.href || entry?.link?.href || '';
    const haystack = `${linkHref} ${contentText}`;
    const match = haystack.match(/\/r\/([^/\s?#]+)/i);
    return match ? match[1] : '';
}

function entryToPost(entry) {
    const title = normalizeText(entry.title);
    const content = extractTextFromHtml(entry.content?._ || entry.content);

    return {
        title,
        text: content,
        upvotes: 0,
        subreddit: extractSubreddit(entry, content)
    };
}

async function fetchRssPosts(searchQuery) {
    const rssQuery = `${searchQuery} self:yes`;
    const url = `https://www.reddit.com/search.rss?q=${encodeURIComponent(
        rssQuery
    )}&limit=25&sort=relevance&t=all&type=link`;

    console.log('🔗 Reddit RSS search:', searchQuery);

    const res = await fetch(url, { headers: REDDIT_HEADERS });

    if (!res.ok) {
        console.error(`❌ Reddit RSS returned ${res.status} for: ${searchQuery}`);
        return [];
    }

    const xml = await res.text();
    const parsed = await xml2js.parseStringPromise(xml, {
        explicitArray: false,
        trim: true
    });

    const entries = [].concat(parsed?.feed?.entry || []);

    return entries
        .filter(entry => String(entry?.id || '').startsWith('t3_'))
        .map(entryToPost)
        .filter(post => post.title || post.text);
}

async function fetchJsonPosts(searchQuery) {
    const url = `https://api.reddit.com/search?q=${encodeURIComponent(
        searchQuery
    )}&limit=25&sort=relevance&t=all`;

    console.log('🔗 Reddit JSON search:', searchQuery);

    const res = await fetch(url, { headers: REDDIT_HEADERS });

    if (!res.ok) {
        console.error(`❌ Reddit JSON returned ${res.status} for: ${searchQuery}`);
        return [];
    }

    const data = await res.json();

    if (!data?.data?.children) return [];

    return data.data.children.map(p => ({
        title: p.data.title || '',
        text: p.data.selftext || '',
        upvotes: p.data.ups || 0,
        subreddit: p.data.subreddit || ''
    }));
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
            let posts = await fetchRssPosts(searchQuery);

            if (posts.length === 0) {
                posts = await fetchJsonPosts(searchQuery);
            }

            allPosts.push(...posts);

            if (allPosts.length >= 10) {
                break;
            }
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
