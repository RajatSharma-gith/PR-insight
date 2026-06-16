import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import dotenv from "dotenv";
import { z } from "zod";
dotenv.config();

import type { ReviewState, ReviewFinding } from "./state.js";

const model = new ChatGoogleGenerativeAI({
    model: "gemini-3.5-flash",
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
    }))
});

async function runAgent(
    state: ReviewState,
    agentName: string,
    systemPrompt: string,
): Promise<{ findings: ReviewFinding[] }> {
    const structuredModel = model.withStructuredOutput(findingsSchema);

    let contextPrompt = `Review the following PR changes and provide findings in the specified format, also reporting any issues found:\n\nDiff:\n${state.diff}\n\n`;
    
    if (state.fileContexts && state.fileContexts.length > 0) {
        contextPrompt += `Full Context for changed files:\n`;
        state.fileContexts.forEach(file => {
            contextPrompt += `--- File: ${file.filename} (Status: ${file.status}) ---\n`;
            if (file.previousCode) contextPrompt += `[Previous Code (Main Branch)]\n${file.previousCode}\n\n`;
            if (file.newCode) contextPrompt += `[New Code (PR Branch)]\n${file.newCode}\n\n`;
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

export async function securityAgent(state: ReviewState): Promise<{ findings: ReviewFinding[] }> {
    return runAgent(
        state,
        "security",
        `You are a security-focused code reviewe. Analyze the diff for:
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
        Provide detailed findings with severity levels and suggestions for remediation.`
    )
}

export async function bugDetectionAgent(state: ReviewState): Promise<{ findings: ReviewFinding[] }> {
    return runAgent(
        state,
        "bugDetection",
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
        Provide detailed findings with severity levels and suggestions for remediation.`
    )
}

export async function codeQualityAgent(state: ReviewState): Promise<{ findings: ReviewFinding[] }> {
    return runAgent(
        state,
        "codeQuality",
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
        Provide detailed findings with severity levels and suggestions for improvement.`
    )
}

export async function summarizerAgent(state: ReviewState): Promise<{ summary: string }> {
    const { findings } = state;

    if (findings.length === 0) {
        return { summary: "## Code review summary \n\n No issies found . the cpde looks good" };
    }

    const response = await model.invoke([
        {
            role: "system",
            content: `You are a tech lead summarizing code review. Organise the findings into a clear prioritized markdown report with these sections:
            1. Critical Issues (must fix before merge)
            2. suggestions (should consider)
            3. Nitpicks (minor improvements)
            `
        },
        {
            role: "user",
            content: JSON.stringify(findings, null, 2)
        }
    ]);
    return { summary: response.content as string }
}