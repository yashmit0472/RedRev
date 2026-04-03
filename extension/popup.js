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
            func: () => {
                // Amazon
                let el = document.querySelector("#productTitle");
                if (el) return el.innerText.trim();

                // Flipkart
                el = document.querySelector(".B_NuCI");
                if (el) return el.innerText.trim();

                // Flipkart alternate selector
                el = document.querySelector("span.VU-ZEz");
                if (el) return el.innerText.trim();

                return null;
            }
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
        const res = await fetch("http://localhost:5000/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: productTitle })
        });

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
        console.error("Popup error:", err);
        content.innerHTML = '<p class="error">' + err.message + '<br><br>Make sure the backend server is running:<br><code>node server.js</code></p>';
    }
});

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

function displayResults(r) {
    const content = document.getElementById("content");

    const scoreClass = r.score >= 70 ? "score-good" : r.score >= 40 ? "score-ok" : "score-bad";

    const hasPros = r.pros && r.pros.length > 0 && r.pros[0] !== "Not enough reliable data";
    const hasCons = r.cons && r.cons.length > 0 && r.cons[0] !== "AI analysis failed or weak reviews";

    const prosHTML = hasPros
        ? r.pros.map(function(p) { return "<li>" + p + "</li>"; }).join("")
        : "<li>No detailed data available</li>";

    const consHTML = hasCons
        ? r.cons.map(function(c) { return "<li>" + c + "</li>"; }).join("")
        : "<li>No detailed data available</li>";

    content.innerHTML =
        '<div class="score-box ' + scoreClass + '">' +
            '<span class="score-number">' + r.score + '</span>' +
            '<span class="score-label">/ 100</span>' +
        '</div>' +
        '<p class="recommendation">' + r.recommendation + '</p>' +
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