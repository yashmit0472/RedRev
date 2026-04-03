document.addEventListener("DOMContentLoaded", () => {
    chrome.storage.local.get("result", (data) => {
        if (!data.result) {
            document.getElementById("content").innerText = "No data";
            return;
        }

        const r = data.result;

        document.getElementById("content").innerHTML = `
            <h3>Score: ${r.score}</h3>
            <p>${r.recommendation}</p>

            <h4>Pros</h4>
            <ul>${r.pros.map(p => `<li>${p}</li>`).join("")}</ul>

            <h4>Cons</h4>
            <ul>${r.cons.map(c => `<li>${c}</li>`).join("")}</ul>
        `;
    });
});