import "dotenv/config";
import { fetchPRDiff } from "./github.js";
import { buildReviewGraph } from "./graph.js";

async function main(){

    const prUrl = process.argv[2];

    if(!prUrl){
        console.error("Usage: npx tsx src/index.ts <github-pr-url>");
        console.error("Example: npx tsx src/index.ts https://github.com/owner/repo/pull/123");

        process.exit(1);
    }


    console.log(`\n fetching pr diff from ${prUrl}\n`);

    const {files, diff} = await fetchPRDiff(prUrl);

    console.log( ` found ${files.length} changed files`);

    console.log(`running review agents in parallel ...`);

    const graph = buildReviewGraph();

    const result = await graph.invoke({
        prUrl,
        diff,
        files: files.map((f)=>f.filename),
        fileContexts: files,

        findings: [],
        summary: "",
    })

    console.log("=".repeat(60));
    console.log(result.summary);
    console.log("=".repeat(60));
    console.log(`\n total findings : ${result.findings.length}`);

    console.log(`critical: ${result.findings.filter((f)=>f.severity === "critical").length}`);

    console.log(`suggestions: ${result.findings.filter((f)=>f.severity === "suggestion").length} `);
    console.log(`nitpics: ${result.findings.filter((f)=>f.severity === "nitpick").length} `);



}

main().catch(console.error);