function getTitle() {
    let t = document.querySelector("#productTitle");
    if (!t) t = document.querySelector(".B_NuCI");
    return t ? t.innerText.trim() : null;
}

const title = getTitle();

if (title) {
    console.log("Product:", title);

    chrome.runtime.sendMessage({
        type: "PRODUCT",
        title
    });
}