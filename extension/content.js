function getTitle() {
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

    return meta?.content?.trim() || document.title?.trim() || null;
}

const title = getTitle();

if (title) {
    console.log("Product:", title);

    chrome.runtime.sendMessage({
        type: "PRODUCT",
        title
    });
}
