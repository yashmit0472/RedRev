const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');

const { getRedditPosts } = require('./reddit');
const { analyzeWithGemini } = require('./scoreCalAI');
const { getRecommendation } = require('./scorer');

const app = express();
app.use(cors());
app.use(express.json());

app.post('/analyze', async (req, res) => {
    try {
        const { title } = req.body;

        if (!title) {
            return res.status(400).json({ error: "Title required" });
        }

        console.log("🔍 Analyzing:", title);

        // 🔹 STEP 1: Reddit
        let posts = await getRedditPosts(title);

        console.log("📊 Posts fetched:", posts.length);

        // 🔥 FIX 1: fallback if Reddit fails
        if (!posts || posts.length === 0) {
            console.log("⚠️ No Reddit data, using fallback");

            posts = [
                {
                    title: `${title} - general user discussion`,
                    text: `Users discuss the ${title} product quality, value for money, and overall experience.`,
                    upvotes: 0,
                    subreddit: "general"
                }
            ];
        }

        // 🔹 STEP 2: Gemini
        const geminiResult = await analyzeWithGemini(posts, title);

        console.log("🤖 Gemini result:", geminiResult);

        // 🔹 STEP 3: Score
        const score = Math.max(0, Math.min(100, geminiResult.score || 50));

        // 🔹 STEP 4: Response
        res.json({
            score,
            recommendation: getRecommendation(score),
            pros: geminiResult.pros || [],
            cons: geminiResult.cons || [],
            reviews: posts.slice(0, 5)
        });

    } catch (err) {
        console.error("💥 Server Error:", err.message);

        res.status(500).json({
            error: "Internal server error"
        });
    }
});

app.listen(5000, () => {
    console.log("🚀 Server running on port 5000");
});