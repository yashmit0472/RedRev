const Sentiment = require('sentiment');
const sentiment = new Sentiment();

function analyze(text) {
    return sentiment.analyze(text).score;
}

module.exports = { analyze };