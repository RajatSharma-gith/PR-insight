import "dotenv/config";
import { securityAgent } from "./agents.js";

import type { ReviewState } from "./state";

const testState: ReviewState = {
    prUrl: "https://github.com/test/test/pull/1",
    diff: `---src/login.ts---
        +const password = "admin123";
        +const query = \`select * from users where name = '\${userInput}\';`,
    files: ["src/login.ts"],
    fileContexts: [],
    findings: [],
    summary: "",

}

const result = await securityAgent(testState);
console.log(JSON.stringify(result, null, 2));