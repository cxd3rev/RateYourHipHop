import { dailySync, readStatus } from "../catalog/pipeline.mjs";

export default async function handler(req, res) {
    const secret = process.env.CRON_SECRET;
    const header = req.headers.authorization || "";
    if (secret && header !== `Bearer ${secret}`) {
        res.status(401).json({ error: "unauthorized" });
        return;
    }
    try {
        const result = await dailySync();
        res.status(200).json({
            ok: true,
            supabase: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
            stats: result.stats
        });
    } catch (error) {
        res.status(500).json({ ok: false, error: String(error.message || error) });
    }
}

export { readStatus };
