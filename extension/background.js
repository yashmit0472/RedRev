chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "PRODUCT") {
        fetch("http://localhost:5000/analyze", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ title: msg.title })
        })
            .then(res => res.json())
            .then(data => {
                chrome.storage.local.set({ result: data });
            });
    }
});