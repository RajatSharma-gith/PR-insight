import { Annotation } from "@langchain/langgraph";

export interface ReviewFinding {
    severity: "critical" | "suggestion" | "nitpick";
    file: string;
    line?: number;
    issue: string;
    suggestion: string;
    agent: string;
}

export interface FileContext {
    filename: string;
    patch: string;
    status: string;
    previousCode?: string | null;
    newCode?: string | null;
}

export const ReviewStateAnnotation = Annotation.Root({
    prUrl: Annotation<string>,
    diff: Annotation<string>,
    files: Annotation<string[]>({
        reducer: (left, right) => (right.length > 0 ? right : left),
        default: () => [],
    }),
    fileContexts: Annotation<FileContext[]>({
        reducer: (left, right) => (right.length > 0 ? right : left),
        default: () => [],
    }),
    findings: Annotation<ReviewFinding[]>({
        reducer: (left, right) => left.concat(right),
        default: () => [],
    }),
    summary: Annotation<string>({
        reducer: (_left, right) => right,
        default: () => "",
    }),
})

export type ReviewState = typeof ReviewStateAnnotation.State;