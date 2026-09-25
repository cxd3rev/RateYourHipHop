import fs from "fs";
import path from "path";
import { readStatus } from "./pipeline.mjs";

export default async function handler(req, res) {
    const status = readStatus();
    res.status(200).json(status);
}

export function readDiscoveryFile() {
    const file = path.resolve(process.cwd(), "data", "discovery.json");
    try {
        return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
        return null;
    }
}
