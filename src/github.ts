import { Octokit } from "octokit";
import dotenv from "dotenv";

dotenv.config();

const octokit = new Octokit({
    auth: process.env.GITHUB_PERSONAL_ACCESS_TOKEN,
});

export interface PRFile {
    filename: string,
    patch: string
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
    const { data: files } = await octokit.rest.pulls.listFiles({
        owner,
        repo,
        pull_number: pullNumber
    });

    const prFiles: PRFile[] = files.filter((f) => f.patch).map((f) => ({
        filename: f.filename,
        patch: f.patch as string
    }));

    const diff = prFiles.map((f) => `--- ${f.filename} \n${f.patch}`).join("\n\n");

    return { files: prFiles, diff };
}