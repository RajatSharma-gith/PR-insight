import "dotenv/config";


import { fetchPRDiff } from "./github.js";

// A well-known public PR on GitHub's example repo
const testUrl = "https://github.com/octocat/Hello-World/pull/1";

async function getPRdiff() {
    const result = await fetchPRDiff(testUrl);
    console.log(`Found ${result.files.length} changed files`);
    console.log(result.diff.substring(0, 500));
}

getPRdiff().catch((err) => {
    console.error("Error fetching PR diff:", err);
});

