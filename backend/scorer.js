function getRecommendation(score) {
    if (score >= 70) return "Buy";
    if (score >= 40) return "Consider";
    return "Avoid";
}

module.exports = { getRecommendation };