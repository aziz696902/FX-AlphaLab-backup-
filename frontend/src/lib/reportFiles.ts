import { promises as fs } from "fs";
import path from "path";

const reportsDir = path.resolve(process.cwd(), "..", "outputs", "reports");

export async function readLatestReport(): Promise<unknown | null> {
  try {
    const entries = await fs.readdir(reportsDir, { withFileTypes: true });
    const jsonFiles = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => entry.name);

    if (jsonFiles.length === 0) {
      return null;
    }

    const stats = await Promise.all(
      jsonFiles.map(async (name) => {
        const fullPath = path.join(reportsDir, name);
        const stat = await fs.stat(fullPath);
        return { name, fullPath, mtimeMs: stat.mtimeMs };
      })
    );

    const latest = stats.sort((a, b) => b.mtimeMs - a.mtimeMs)[0];
    const raw = await fs.readFile(latest.fullPath, "utf-8");
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}
