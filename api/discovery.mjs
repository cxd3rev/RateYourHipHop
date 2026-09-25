import { readDiscoveryFile } from "./catalog/status.mjs";

async function fromSupabase() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return null;
    const since = new Date();
    since.setDate(since.getDate() - 45);
    const query = new URL(`${url.replace(/\/$/, "")}/rest/v1/albums`);
    query.searchParams.set("select", "provider_id,title,artist_name,artwork_url,release_date,project_type,track_count,genres");
    query.searchParams.set("release_date", `gte.${since.toISOString().slice(0, 10)}`);
    query.searchParams.set("order", "release_date.desc");
    query.searchParams.set("limit", "60");
    const response = await fetch(query, {
        headers: { apikey: key, Authorization: `Bearer ${key}` }
    });
    if (!response.ok) return null;
    const rows = await response.json();
    const today = [];
    const week = [];
    const recent = [];
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    for (const row of rows) {
        const card = {
            provider: "deezer",
            providerId: row.provider_id,
            title: row.title,
            artist: row.artist_name,
            cover: row.artwork_url,
            releaseDate: row.release_date,
            projectType: row.project_type,
            trackCount: row.track_count,
            genres: row.genres || ["Hip-Hop"]
        };
        const released = row.release_date ? new Date(row.release_date) : null;
        const age = released ? now.getTime() - released.getTime() : 999 * 86400000;
        if (age <= 86400000 && age >= -86400000) today.push(card);
        else if (age >= 0 && age < 7 * 86400000) week.push(card);
        else recent.push(card);
    }
    return {
        source: "supabase",
        droppedToday: today,
        thisWeek: week,
        recent,
        newArtists: []
    };
}

export default async function handler(req, res) {
    try {
        const remote = await fromSupabase();
        if (remote) {
            res.status(200).json(remote);
            return;
        }
    } catch {
        /* fall through */
    }
    const file = readDiscoveryFile();
    if (file) {
        res.status(200).json({ source: "file", ...file });
        return;
    }
    res.status(200).json({ source: "local" });
}
