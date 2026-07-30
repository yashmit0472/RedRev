// Uses Node.js built-in fetch (v18+)

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
const FALLBACK_MODELS = ["gemini-2.5-flash-lite", "gemini-2.5-flash"];

function getModelCandidates() {
    return [GEMINI_MODEL, ...FALLBACK_MODELS].filter((model, index, models) => {
        return model && models.indexOf(model) === index;
    });
}

function getGenerationConfig(model) {
    const config = {
        responseMimeType: "application/json",
        maxOutputTokens: 700
    };

    if (model.startsWith("gemini-3")) {
        config.thinkingConfig = { thinkingLevel: "minimal" };
    } else if (model.includes("2.5-flash")) {
        config.thinkingConfig = { thinkingBudget: 0 };
    }

    return config;
}

async function callGeminiWithRetry(prompt, retries = 3) {
    for (const model of getModelCandidates()) {
        for (let i = 0; i < retries; i++) {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: getGenerationConfig(model)
                    })
                }
            );

            if (response.status === 429) {
                const wait = (i + 1) * 1500; // 1.5s, 3s, 4.5s
                console.log(`Gemini ${model} rate limited, retrying in ${wait / 1000}s...`);
                await new Promise(r => setTimeout(r, wait));
                continue;
            }

            if ([400, 404].includes(response.status) && i === 0) {
                const message = await response.text();
                console.error(`Gemini ${model} unavailable: ${response.status} ${message.slice(0, 140)}`);
                break;
            }

            if (!response.ok) {
                const message = await response.text();
                console.error(`Gemini ${model} HTTP ${response.status}: ${message.slice(0, 140)}`);
                return null;
            }

            const data = await response.json();
            return data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
        }
    }

    console.error("Gemini failed after retries");
    return null;
}

async function analyzeWithGemini(reviews, productTitle) {
    try {
        const limitedReviews = reviews.slice(0, 5);

        const reviewText = limitedReviews
            .map((r, i) => {
                const text = `${r.title} ${r.text}`.slice(0, 1200);
                return `${i + 1}. ${text}`;
            })
            .join("\n\n");

        const prompt = `
You are an expert product reviewer.

Product: ${productTitle}

Below are Reddit user reviews. Only consider reviews that clearly talk about THIS product.

${reviewText}

Tasks:
1. Extract up to 4 clear pros
2. Extract up to 4 clear cons
3. Give a realistic BUY SCORE from 0 to 100
4. Give final verdict: Buy / Consider / Avoid

Rules:
- Ignore unrelated products
- Be honest, not overly positive
- If data is weak, keep score around 40-60
- Keep each pro and con under 18 words

Return STRICT JSON ONLY:
{
  "score": number,
  "pros": ["..."],
  "cons": ["..."],
  "verdict": "Buy" | "Consider" | "Avoid"
}
`;

        const text = await callGeminiWithRetry(prompt);

        if (!text) {
            throw new Error("No Gemini response after retries");
        }

        console.log("Gemini raw:", text.substring(0, 200));

        const jsonMatch = text.match(/\{[\s\S]*\}/);

        if (!jsonMatch) throw new Error("Invalid JSON in response");

        const parsed = JSON.parse(jsonMatch[0]);

        return {
            score: Math.max(0, Math.min(100, parsed.score || 50)),
            pros: parsed.pros || [],
            cons: parsed.cons || [],
            verdict: parsed.verdict || "Consider"
        };

    } catch (error) {
        console.error("Gemini Error:", error.message);

        return {
            score: 50,
            pros: ["Not enough reliable data"],
            cons: ["AI analysis failed or weak reviews"],
            verdict: "Consider"
        };
    }
}

module.exports = { analyzeWithGemini };
