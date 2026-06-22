import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import dotenv from "dotenv";
import { z } from "zod";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { TaskType } from "@google/generative-ai";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { createRetrievalChain } from "langchain/chains/retrieval";
import { Document } from "@langchain/core/documents";
import { loadQAStuffChain } from "langchain/chains";
dotenv.config();

import type { ReviewState, ReviewFinding } from "./state.js";
import { RunnableSequence } from "@langchain/core/runnables";

const model = new ChatGoogleGenerativeAI({
    // Corrected model name for better performance and validity
    model: "gemini-1.5-flash-latest",
    temperature: 0.4,
    apiKey: process.env.GOOGLE_API_KEY
});

const findingsSchema = z.object({
    findings: z.array(z.object({
        severity: z.enum(["critical", "suggestion", "nitpick"]),
        file: z.string(),
        line: z.number().optional(),
        issue: z.string(),
        suggestion: z.string(),
        agent: z.string(),
        suggestedFix: z.string().optional().describe("A code block with a diff showing the suggested fix. Use standard diff format with `+` for additions and `-` for deletions."),
    }))
});

const changeAnalysisSchema = z.object({
    whatChanged: z.string().describe("A high-level summary of what changed in the code."),
    whyItMatters: z.string().describe("The impact or reasoning behind the change (e.g., improves performance, fixes a bug, adds a feature)."),
    potentialRisks: z.string().describe("Any potential risks, side effects, or areas that need careful testing introduced by this change."),
});

function addLineNumbers(code: string): string {
    return code.split('\n').map((line, index) => `${index + 1}\t${line}`).join('\n');
}

async function runAgent(
    state: ReviewState,
    agentName: string,
    systemPrompt: string,
): Promise<{ findings: ReviewFinding[] }> {
    const structuredModel = model.withStructuredOutput(findingsSchema);
 
    let contextPrompt = `Review the following PR changes and provide findings in the specified format. For context, the full file contents are provided with line numbers.\n\nDiff:\n${state.diff}\n\n`;
    
    if (state.fileContexts && state.fileContexts.length > 0) {
        contextPrompt += `Full Context for changed files (with line numbers):\n`;
        state.fileContexts.forEach(file => {
            contextPrompt += `--- File: ${file.filename} (Status: ${file.status}) ---\n`;
            if (file.previousCode) contextPrompt += `[Previous Code (Main Branch)]\n${addLineNumbers(file.previousCode)}\n\n`;
            if (file.newCode) contextPrompt += `[New Code (PR Branch)]\n${addLineNumbers(file.newCode)}\n\n`;
        });
    }

    const response = await structuredModel.invoke([
        {
            role: "system",
            content: systemPrompt,
        },
        {
            role: "user",
            content: contextPrompt,
        },
    ]);

    const findings: ReviewFinding[] = response.findings.map((f) => ({
        ...f,
        agent: agentName,
    }));
    return { findings };
}

export async function changeAnalysisAgent(state: ReviewState): Promise<{ changeAnalysis: string }> {
    const structuredModel = model.withStructuredOutput(changeAnalysisSchema);

    const systemPrompt = `You are a senior software engineer analyzing a pull request. Your task is to provide a concise analysis of the changes.
Based on the provided diff and full file contexts, explain what changed, why it matters, and identify potential risks.
Focus on the high-level architectural and logical changes, not minor syntax fixes.
Present your analysis clearly and concisely in the specified format.`;

    let contextPrompt = `Analyze the following PR changes.\n\nDiff:\n${state.diff}\n\n`;
    
    if (state.fileContexts && state.fileContexts.length > 0) {
        contextPrompt += `Full Context for changed files (with line numbers):\n`;
        state.fileContexts.forEach(file => {
            contextPrompt += `--- File: ${file.filename} (Status: ${file.status}) ---\n`;
            if (file.previousCode) contextPrompt += `[Previous Code (Main Branch)]\n${addLineNumbers(file.previousCode)}\n\n`;
            if (file.newCode) contextPrompt += `[New Code (PR Branch)]\n${addLineNumbers(file.newCode)}\n\n`;
        });
    }

    const response = await structuredModel.invoke([
        { role: "system", content: systemPrompt, },
        { role: "user", content: contextPrompt, },
    ]);

    const changeAnalysis = `## Change Analysis

### What Changed
${response.whatChanged}

### Why It Matters
${response.whyItMatters}

### Potential Risks
${response.potentialRisks}`;

    return { changeAnalysis };
}

export async function securityAgent(state: ReviewState): Promise<{ findings: ReviewFinding[] }> {
    return runAgent(
        state,
        "Security",
        `You are a security-focused code reviewer. Analyze the diff for:
        -SQL injection vulnerabilities
        -Hardcoded secrets or api keys
        -Insecure dependencies
        -Improper authentication or authorization
        -Other common security issues in code
        -XSS vulnerabilities
        -Insecure deserialization
        -Authentication/authorization issues
        -Path traversal vulnerabilities
        -Insecure use of cryptography
        -Server-side request forgery (SSRF)
        -Insecure configuration
        -Insufficient logging and monitoring
        -Other security best practices violations
        For each finding, you MUST specify the 'file' and the 'line' number where the issue is located. Provide detailed findings with severity levels and suggestions for remediation. If possible, also provide a 'suggestedFix' in a standard diff format.`
    )
}

export async function bugDetectionAgent(state: ReviewState): Promise<{ findings: ReviewFinding[] }> {
    return runAgent(
        state,
        "Bug Detection",
        `You are a bug-detection code reviewer. Analyze the diff for:
        -Logic errors or bugs
        
        -Null/undefined dereferences
        -Infinite loops or recursion
        -Race conditions or deadlocks
        -unhandled promise rejections
        -off-by-one errors
        -Edge cases that may not be handled
        -Performance issues
        -Memory leaks or inefficient resource usage
        -Concurrency issues
        -Error handling problems
        -Other common coding mistakes that could lead to bugs
        For each finding, you MUST specify the 'file' and the 'line' number where the issue is located. Provide detailed findings with severity levels and suggestions for remediation. If possible, also provide a 'suggestedFix' in a standard diff format.`
    )
}

export async function codeQualityAgent(state: ReviewState): Promise<{ findings: ReviewFinding[] }> {
    return runAgent(
        state,
        "Code Quality",
        `You are a code-quality-focused reviewer. Analyze the diff for:
        -Code readability and maintainability issues
        -Adherence to coding standards and best practices
        -Code organization and structure problems
        -poor naming conventions
        -Functions that are too long or do too much
        -code duplication
        -dead code
        -missing error handling
        -Lack of comments or documentation
        -Complex or convoluted code that could be simplified
        -Inconsistent naming conventions
        -Redundant or duplicate code
        -Inefficient algorithms or data structures
        -Other code quality issues that could make the code harder to understand or maintain
        For each finding, you MUST specify the 'file' and the 'line' number where the issue is located. Provide detailed findings with severity levels and suggestions for improvement. If possible, also provide a 'suggestedFix' in a standard diff format.`
    )
}

export async function summarizerAgent(state: ReviewState): Promise<{ summary: string }> {
    const { findings, changeAnalysis } = state;

    if (findings.length === 0) {
        const summary = `${changeAnalysis}\n\n---\n\n## Code Review Findings\n\nNo issues found. The code looks good!`;
        return { summary };
    }

    const response = await model.invoke([
        {
            role: "system",
            content: `You are a tech lead summarizing a code review. The user has provided a high-level change analysis and a JSON array of detailed findings.
            Your task is to combine these into a single, coherent markdown report.
            
            Start with the provided "Change Analysis" section.
            Then, add a separator and a "Code Review Findings" section.
            Organize the detailed findings into a clear, prioritized list under the "Code Review Findings" section.
            For each finding, include the file and line number (e.g., \`src/auth.ts:45\`).
            Group the findings into these sections:
            1.  **Critical Issues** (must fix before merge)
            2.  **Suggestions** (should consider)
            3.  **Nitpicks** (minor improvements)
            
            If a finding is missing a line number, just show the file name.
            If a 'suggestedFix' is provided for a finding, display it clearly under the finding's details, formatted as a diff code block.
            Make your summary clear and actionable for the developer.`
        },
        {
            role: "user",
            content: `Change Analysis:\n${changeAnalysis}\n\nFindings:\n${JSON.stringify(findings, null, 2)}`
        }
    ]);
    return { summary: response.content as string }
}

export async function ragAgent(state: ReviewState, question: string): Promise<{ answer: string }> {
    console.log(`[RAG] Answering question: "${question}"`);

    const embeddings = new GoogleGenerativeAIEmbeddings({
        model: "embedding-001",
        taskType: TaskType.RETRIEVAL_DOCUMENT,
        apiKey: process.env.GOOGLE_API_KEY,
    });

    const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200,
    });

    const documents: Document[] = [];
    documents.push(new Document({ pageContent: state.diff, metadata: { source: 'diff' } }));
    for (const file of state.fileContexts) {
        const content = file.newCode ?? file.previousCode ?? '';
        if (content) {
            documents.push(new Document({
                pageContent: content,
                metadata: { source: file.filename }
            }));
        }
    }

    const splitDocs = await textSplitter.splitDocuments(documents);
    const vectorStore = await MemoryVectorStore.fromDocuments(splitDocs, embeddings);
    const retriever = vectorStore.asRetriever();

    // Retrieve relevant documents first
    const relevantDocs = await retriever.invoke(question);

    // Build prompt with context
    const context = relevantDocs.map(doc => doc.pageContent).join("\n\n");

    const response = await model.invoke([
        {
            role: "system",
            content: `Answer the user's question based on the following context about a pull request:\n\n${context}`
        },
        {
            role: "user",
            content: question
        }
    ]);

    return { answer: response.content as string };
}