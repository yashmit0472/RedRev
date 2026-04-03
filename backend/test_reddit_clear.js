const { getRedditPosts } = require('./reddit');

(async () => {
    const posts = await getRedditPosts('MuscleTech Platinum Creatine Monohydrate Micronized Powder');
    console.log('\n--- FINAL POSTS ---');
    posts.forEach((p, i) => {
        console.log(`${i+1}. [${p.upvotes}] ${p.title}`);
    });
})();
