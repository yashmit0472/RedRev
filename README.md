# RedRev 🔍

RedRev is a Chrome extension that helps you make informed purchasing decisions on **Amazon** and **Flipkart**. It works by grabbing the product title from the active page, searching Reddit for real user reviews, and utilizing Google's **Gemini AI** to instantly summarize those reviews into Pros, Cons, and a simplified 0-100 verdict score.

## Features

- **Instant Reddit Insights**: No more searching Reddit manually. RedRev finds real conversations about the product automatically.
- **AI-Powered Summarization**: Google Gemini AI reads the top Reddit reviews and provides bite-sized Pros & Cons.
- **At-a-Glance Scoring**: Get a unified 0-100 score and a clear recommendation (Buy / Consider / Avoid) based on community sentiment.
- **Seamless E-commerce Integration**: Works natively on Amazon and Flipkart product pages with a visually appealing, dark-themed popup.

## Repository Structure

The project is split into two main parts:
1. **`extension/`** - The Chrome Extension (Frontend).
2. **`backend/`** - The Node.js Express server that interfaces with Reddit and Gemini APIs.

### 1. Extension (Frontend)
- `manifest.json`: Manifest V3 configuration defining permissions (`activeTab`, `scripting`) and host permissions.
- `popup.html` & `styles.css`: The UI interface that the user interacts with, featuring a clean, dark-mode aesthetic.
- `popup.js`: Extracts the product title from the active tab using standard selectors, cleans the title, and fetches analysis data from the backend.
- `content.js`: Helper script (can be run on page load if background processing is preferred).

### 2. Backend Server
- `server.js`: An Express API exposing the `POST /analyze` endpoint.
- `reddit.js`: Contains robust logic to clean complex product titles down to core brand/model keywords and queries `api.reddit.com` using native `node:fetch`. It filters and scores Reddit posts by relevance.
- `scoreCalAI.js`: Packages the relevant Reddit reviews and prompts Gemini (via your `GEMINI_API_KEY`) to extract actionable pros, cons, and a numerical score. Implements rate-limit retry logic.
- `scorer.js`: Helper configuration to determine textual recommendations ("Buy", "Consider", "Avoid") from the 0-100 score.

## Getting Started

### Prerequisites
- Node.js (v18 or higher recommended to support native fetch)
- Google Gemini API Key

### Backend Setup

1. Navigate to the backend folder:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the `backend/` directory and add your Gemini API key:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   # Optional: defaults to gemini-3.5-flash-lite for faster, cheaper responses
   GEMINI_MODEL=gemini-3.5-flash-lite
   ```
4. Start the backend server:
   ```bash
   node server.js
   ```
   > The server will start on `http://localhost:5000`

### Extension Setup (Chrome)

1. Open Google Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** using the toggle in the top right corner.
3. Click **Load unpacked**.
4. Select the `extension/` folder from this repository.
5. The RedRev icon should appear in your Chrome toolbar. Pin it for quick access!

## Usage

1. Start up your backend server (`node server.js`).
2. Navigate to any product page on Amazon or Flipkart.
3. Click the **RedRev** extension icon.
4. Wait 10-15 seconds for the AI to analyze the Reddit posts.
5. Enjoy your summarized product review!
