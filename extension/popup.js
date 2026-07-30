document.addEventListener("DOMContentLoaded", async () => {
    const content = document.getElementById("content");
    const titleEl = document.getElementById("product-title");

    content.innerHTML = '<p class="loading">Detecting product...</p>';

    try {
        // Step 1: Get the active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab) {
            content.innerHTML = '<p class="error">No active tab found</p>';
            return;
        }

        // Step 2: Extract product title from the page
        const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: extractProductTitleFromPage
        });

        const rawTitle = results?.[0]?.result;

        if (!rawTitle) {
            content.innerHTML = '<p class="error">No product found on this page.<br>Open an Amazon or Flipkart product page.</p>';
            return;
        }

        // Step 3: Clean the title — Amazon titles are absurdly long
        // "MuscleTech Platinum Creatine Monohydrate | 3g per Serving | ..."
        // We only want: "MuscleTech Platinum Creatine Monohydrate"
        const productTitle = cleanProductTitle(rawTitle);

        // Show product name and loading state
        titleEl.textContent = productTitle;
        content.innerHTML = '<p class="loading">Analyzing reviews via Reddit + AI...<br>This may take 10-15 seconds.</p>';

        // Step 4: Call backend API
        const res = await fetchAnalysis(productTitle);

        if (!res.ok) {
            throw new Error("Server error: " + res.status);
        }

        const data = await res.json();

        if (data.error) {
            throw new Error(data.error);
        }

        // Step 5: Display results
        displayResults(data);

    } catch (err) {
        console.warn("Popup request failed:", err);
        content.innerHTML = '<p class="error">' + escapeHTML(err.message) + '<br><br>Make sure the backend server is running:<br><code>cd backend && node server.js</code></p>';
    }
});

async function fetchAnalysis(productTitle) {
    const endpoints = [
        "http://127.0.0.1:5000/analyze",
        "http://localhost:5000/analyze"
    ];

    let lastError;
    let reachedServer = false;

    for (const endpoint of endpoints) {
        try {
            const res = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title: productTitle })
            });

            if (!res.ok) {
                reachedServer = true;
                throw new Error("Server error: " + res.status);
            }

            reachedServer = true;
            return res;
        } catch (err) {
            lastError = err;
        }
    }

    if (reachedServer && lastError) {
        throw lastError;
    }

    throw new Error("Backend server is not reachable");
}

function cleanProductTitle(raw) {
    // Split on common Amazon/Flipkart title separators
    // "Brand Product Name | feature | feature | feature"
    // "Brand Product Name, Color, Size"
    // "Brand Product Name - Some Description"

    let title = raw;

    // Take only the part before the first pipe
    if (title.includes("|")) {
        title = title.split("|")[0].trim();
    }

    // Take only the part before " - " (but not hyphens within words)
    if (title.includes(" - ")) {
        title = title.split(" - ")[0].trim();
    }

    // Take only the part before the first comma (color/size info)
    if (title.includes(",")) {
        title = title.split(",")[0].trim();
    }

    // Remove parenthetical info like (Black) or (128GB)
    title = title.replace(/\(.*?\)/g, "").trim();

    // If still too long, truncate to first 8 words
    const words = title.split(/\s+/);
    if (words.length > 8) {
        title = words.slice(0, 8).join(" ");
    }

    return title;
}

function extractProductTitleFromPage() {
    const selectors = [
        "#productTitle",
        "#title",
        "span.VU-ZEz",
        ".B_NuCI",
        "h1 span",
        "h1"
    ];

    for (const selector of selectors) {
        const el = document.querySelector(selector);
        const text = el?.innerText?.trim();

        if (text) return text;
    }

    const meta = document.querySelector(
        'meta[property="og:title"], meta[name="title"], meta[name="twitter:title"]'
    );
    const metaTitle = meta?.content?.trim();

    if (metaTitle) return metaTitle;

    return document.title?.trim() || null;
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    }[char]));
}

function displayResults(r) {
    const content = document.getElementById("content");

    const score = Number.isFinite(Number(r.score)) ? Math.round(Number(r.score)) : 50;
    const scoreClass = score >= 70 ? "score-good" : score >= 40 ? "score-ok" : "score-bad";

    const hasPros = r.pros && r.pros.length > 0 && r.pros[0] !== "Not enough reliable data";
    const hasCons = r.cons && r.cons.length > 0 && r.cons[0] !== "AI analysis failed or weak reviews";

    const prosHTML = hasPros
        ? r.pros.map(function(p) { return "<li>" + escapeHTML(p) + "</li>"; }).join("")
        : "<li>No detailed data available</li>";

    const consHTML = hasCons
        ? r.cons.map(function(c) { return "<li>" + escapeHTML(c) + "</li>"; }).join("")
        : "<li>No detailed data available</li>";

    content.innerHTML =
        '<div class="score-box ' + scoreClass + '">' +
            '<span class="score-number">' + score + '</span>' +
            '<span class="score-label">/ 100</span>' +
        '</div>' +
        '<p class="recommendation">' + escapeHTML(r.recommendation) + '</p>' +
        '<div class="section">' +
            '<h4>Pros</h4>' +
            '<ul>' + prosHTML + '</ul>' +
        '</div>' +
        '<div class="section">' +
            '<h4>Cons</h4>' +
            '<ul>' + consHTML + '</ul>' +
        '</div>' +
        '<p class="footer">Based on ' + (r.reviews ? r.reviews.length : 0) + ' Reddit reviews</p>';
}
