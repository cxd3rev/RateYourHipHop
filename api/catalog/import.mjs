import { importBatch } from "./pipeline.mjs";

export default async function handler(req, res) {
    if (req.method !== "POST") {
        res.status(405).json({ error: "POST only" });
        return;
    }
    const secret = process.env.CATALOG_IMPORT_SECRET || process.env.CRON_SECRET;
    const header = req.headers.authorization || "";
    if (!secret || header !== `Bearer ${secret}`) {
        res.status(401).json({ error: "unauthorized" });
        return;
    }
    try {
        const checkpoint = await importBatch({ artistLimit: 8 });
        res.status(200).json({
            ok: true,
            status: checkpoint.status,
            progress: checkpoint.progress || 0,
            artists: checkpoint.artists,
            albums: checkpoint.albums,
            tracks: checkpoint.tracks,
            duplicates: checkpoint.duplicates,
            errors: checkpoint.errors
        });
    } catch (error) {
        res.status(500).json({ ok: false, error: String(error.message || error) });
    }
}
