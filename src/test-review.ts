import "dotenv/config"
import { fetchPRDiff } from "./github"
import { buildReviewGraph } from "./graph"

const prUrl = "https://github.com/octocat/Hello-World/pull/1";

async function test() {
    console.log("fetching pr diff ")
    const {files, diff} = await fetchPRDiff(prUrl);

    console.log(`found ${files.length} changed files`);

    console.log("running review agents ");

    const graph = buildReviewGraph();

    const result = await graph.invoke({
        prUrl,
        diff,
        files: files.map((f)=>f.filename),
        findings: [],
        summary: ""
    })

    console.log(result.summary);
    console.log(`total findins : ${result.findings.length}`)
}

test().catch(console.error);