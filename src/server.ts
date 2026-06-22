import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { buildReviewGraph } from "./graph.js";
import { fetchPRDiff } from "./github.js";
import { ragAgent } from "./agents.js";
import type { ReviewFinding } from "./state.js";
import { connectDB, ReviewSession, ChatMessage } from "./db.js";
import { authRouter } from "./auth.js";
import { authenticate, type AuthRequest } from "./middleware.js";
import mongoose from "mongoose";

const app = express();
const port = process.env.PORT || 3001;

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());

// Silently ignore Chrome DevTools polling
app.get("/.well-known/appspecific/com.chrome.devtools.json", (_req, res) => {
  res.status(200).json({});
});

// ─── Auth Routes ──────────────────────────────────────────────────────────────

app.use("/api/auth", authRouter);

// ─── Review Route (protected) ─────────────────────────────────────────────────

app.post("/api/review", authenticate, async (req: AuthRequest, res) => {
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
      changeAnalysis: "",
      findings: [],
      summary: "",
    });

    const critical = result.findings.filter((f: ReviewFinding) => f.severity === "critical").length;
    const suggestions = result.findings.filter((f: ReviewFinding) => f.severity === "suggestion").length;
    const nitpicks = result.findings.filter((f: ReviewFinding) => f.severity === "nitpick").length;

    // Persist review session to MongoDB
    let sessionId: string | null = null;
    if (req.user) {
      const session = await ReviewSession.create({
        userId: req.user._id,
        prUrl,
        summary: result.summary,
        findingsCount: result.findings.length,
        criticalCount: critical,
        suggestionsCount: suggestions,
        nitpicksCount: nitpicks,
      });
      sessionId = session._id.toString();
    }

    res.json({
      sessionId,
      summary: result.summary,
      findingsCount: result.findings.length,
      critical,
      suggestions,
      nitpicks,
    });
  } catch (error: any) {
    console.error("[API] Error processing review:", error);
    res.status(500).json({ error: error.message || "Failed to process the review" });
  }
});

// ─── Ask Route (protected) ────────────────────────────────────────────────────

app.post("/api/ask", authenticate, async (req: AuthRequest, res) => {
  const { prUrl, question, sessionId } = req.body;

  if (!prUrl || !question) {
    return res.status(400).json({ error: "PR URL and question are required" });
  }

  try {
    console.log(`[API] Fetching PR data for question: "${question}"`);
    const { files, diff } = await fetchPRDiff(prUrl);

    console.log(`[API] Running RAG agent...`);
    const { answer } = await ragAgent(
      {
        prUrl,
        diff,
        files: files.map((f) => f.filename),
        fileContexts: files,
        findings: [],
        summary: "",
        changeAnalysis: "",
      },
      question
    );

    // Persist Q&A messages to MongoDB
    if (req.user && sessionId) {
      const sid = new mongoose.Types.ObjectId(sessionId);
      await ChatMessage.insertMany([
        { sessionId: sid, role: "user", content: question },
        { sessionId: sid, role: "assistant", content: answer },
      ]);
    }

    res.json({ answer });
  } catch (error: any) {
    console.error("[API] Error processing question:", error);
    res.status(500).json({ error: error.message || "Failed to process the question" });
  }
});

// ─── History Routes (protected) ───────────────────────────────────────────────

app.get("/api/history", authenticate, async (req: AuthRequest, res) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });

  const sessions = await ReviewSession.find({ userId: req.user._id })
    .sort({ createdAt: -1 })
    .lean();

  res.json({ sessions });
});

app.get("/api/history/:id", authenticate, async (req: AuthRequest, res) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });

  const session = await ReviewSession.findOne({
    _id: req.params.id,
    userId: req.user._id,
  }).lean();

  if (!session) return res.status(404).json({ error: "Session not found." });

  const messages = await ChatMessage.find({ sessionId: session._id })
    .sort({ createdAt: 1 })
    .lean();

  res.json({ session, messages });
});

app.delete("/api/history/:id", authenticate, async (req: AuthRequest, res) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });

  await ReviewSession.deleteOne({ _id: req.params.id, userId: req.user._id });
  await ChatMessage.deleteMany({ sessionId: req.params.id });
  res.json({ success: true });
});

// ─── Static Frontend ──────────────────────────────────────────────────────────

app.use(express.static(path.resolve("client/dist")));

app.get("*", (_req, res) => {
  res.sendFile(path.resolve("client/dist/index.html"));
});

// ─── Start ────────────────────────────────────────────────────────────────────

connectDB().then(() => {
  app.listen(port, () => {
    console.log(`🚀 Backend API Server running at http://localhost:${port}`);
  });
}).catch((err) => {
  console.error("❌ Failed to connect to MongoDB:", err);
  process.exit(1);
});