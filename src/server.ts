import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fetchPRDiff } from "./github.js"; // Explicit .js extension for ESM
import { buildReviewGraph } from "./graph.js";
import type { ReviewFinding } from "./state.js";

const app = express();
const port = process.env.PORT || 3001; // Backend on port 3001

app.use(cors()); // Allow frontend to communicate with this API
app.use(express.json());

// Silently ignore Chrome DevTools polling to prevent 404 logs
app.get("/.well-known/appspecific/com.chrome.devtools.json", (req, res) => {
    res.status(200).json({});
});

app.post("/api/review", async (req, res) => {
    const { prUrl } = req.body;
    
    if (!prUrl) {
        return res.status(400).json({ error: "PR URL is required" });
    }

    try {
        console.log(`[API] Fetching PR diff from ${prUrl}`);
        const { files, diff } = await fetchPRDiff(prUrl);

        console.log(`[API] Found ${files.length} changed files. Running agents in parallel...`);
        const graph = buildReviewGraph();

        const result = await graph.invoke({
            prUrl,
            diff,
            files: files.map((f) => f.filename),
            fileContexts: files,
            findings: [],
            summary: "",
        });

        res.json({
            summary: result.summary,
            findingsCount: result.findings.length,
            critical: result.findings.filter((f: ReviewFinding) => f.severity === "critical").length,
            suggestions: result.findings.filter((f: ReviewFinding) => f.severity === "suggestion").length,
            nitpicks: result.findings.filter((f: ReviewFinding) => f.severity === "nitpick").length,
        });
    } catch (error: any) {
        console.error("[API] Error processing review:", error);
        res.status(500).json({ error: error.message || "Failed to process the review" });
    }
});

// Serve static files from the React frontend app
app.use(express.static(path.resolve("client/dist")));

app.get("*", (req, res) => {
    res.sendFile(path.resolve("client/dist/index.html"));
});

app.listen(port, () => {
    console.log(`🚀 Backend API Server running at http://localhost:${port}`);
});