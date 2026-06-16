import { StateGraph } from "@langchain/langgraph";
import { ReviewStateAnnotation } from "./state.js";

import {
  securityAgent,
  bugDetectionAgent,
  codeQualityAgent,
  summarizerAgent,
} from "./agents.js";

export function buildReviewGraph() {
  const graph = new StateGraph(ReviewStateAnnotation)

    // Nodes
    .addNode("security", securityAgent)
    .addNode("bugDetector", bugDetectionAgent)
    .addNode("codeQuality", codeQualityAgent)
    .addNode("summarizer", summarizerAgent)

    // Start → Agents
    .addEdge("__start__", "security")
    .addEdge("__start__", "bugDetector")
    .addEdge("__start__", "codeQuality")

    // Agents → Summarizer
    .addEdge("security", "summarizer")
    .addEdge("bugDetector", "summarizer")
    .addEdge("codeQuality", "summarizer")

    // End
    .addEdge("summarizer", "__end__");

  return graph.compile();
}