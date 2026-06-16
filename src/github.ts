import { Octokit } from "octokit";
import dotenv from "dotenv";

dotenv.config();

const octokit = new Octokit({
    auth: process.env.GITHUB_PERSONAL_ACCESS_TOKEN,
});

export interface PRFile {
    filename: string,
    patch: string,
    status: string,
    previousCode?: string | null,
    newCode?: string | null
}

export function parsePRURL(url: string): {
    owner: string;
    repo: string;
    pullNumber: number;
} {
    const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/);
    if (!match) {
        throw new Error("Invalid PR URL");
    }
    return {
        owner: match[1],
        repo: match[2],
        pullNumber: parseInt(match[3], 10)
    };
}

export async function fetchPRDiff(url: string): Promise<{
    files: PRFile[];
    diff: string;
}> {
    const { owner, pullNumber, repo } = parsePRURL(url);

    // Get PR details to fetch base and head SHAs
    const { data: pr } = await octokit.rest.pulls.get({
        owner,
        repo,
        pull_number: pullNumber
    });
    const baseSha = pr.base.sha;
    const headSha = pr.head.sha;

    const { data: files } = await octokit.rest.pulls.listFiles({
        owner,
        repo,
        pull_number: pullNumber
    });

    const prFiles: PRFile[] = await Promise.all(files.filter((f) => f.patch).map(async (f) => {
        let previousCode = null;
        let newCode = null;

        try {
            if (f.status !== "added") {
                const baseRes = await octokit.rest.repos.getContent({ owner, repo, path: f.filename, ref: baseSha });
                if (!Array.isArray(baseRes.data) && baseRes.data.type === "file" && baseRes.data.content) {
                    previousCode = Buffer.from(baseRes.data.content, "base64").toString("utf-8");
                }
            }
            if (f.status !== "removed") {
                const headRes = await octokit.rest.repos.getContent({ owner, repo, path: f.filename, ref: headSha });
                if (!Array.isArray(headRes.data) && headRes.data.type === "file" && headRes.data.content) {
                    newCode = Buffer.from(headRes.data.content, "base64").toString("utf-8");
                }
            }
        } catch (e) {
            console.error(`Warning: Could not fetch full content for ${f.filename}`);
        }
        return {
            filename: f.filename,
            patch: f.patch as string,
            status: f.status,
            previousCode,
            newCode
        };
    }));

    const diff = prFiles.map((f) => `--- ${f.filename} \n${f.patch}`).join("\n\n");

    return { files: prFiles, diff };
}