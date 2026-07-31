import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("SPA hosting config", () => {
  it("rewrites app deep links to the frontend entrypoint for static hosting", () => {
    const configPath = join(process.cwd(), "vercel.json");
    const config = JSON.parse(readFileSync(configPath, "utf8")) as {
      rewrites?: { source: string; destination: string }[];
    };

    expect(config.rewrites).toContainEqual({ source: "/app/:path*", destination: "/index.html" });
  });
});
