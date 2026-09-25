import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createDeezerProvider } from "./deezerProvider.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DATA = path.join(ROOT, "data");
const CHECKPOINT = path.join(DATA, "catalog-checkpoint.json");
const DISCOVERY = path.join(DATA, "discovery.json");

function emptyCheckpoint() {
    return {
        status: "idle",
        artistIndex: 0,
        artistTotal: null,
        artists: 0,
        albums: 0,
        tracks: 0,
        duplicates: 0,
        errors: 0,
        seenArtists: {},
        seenAlbums: {},
        lastError: null
    };
}

function readJson(file, fallback) {
    try {
        return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
        return fallback;
    }
}

function writeJson(file, value) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

function supabaseConfig() {
    const url = process.env.SUPABASE_URL || "";
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    if (!url || !key) return null;
    return { url: url.replace(/\/$/, ""), key };
}

async function upsert(table, rows, onConflict) {
    const cfg = supabaseConfig();
    if (!cfg || !rows.length) return { remote: false };
    const response = await fetch(
        `${cfg.url}/rest/v1/${table}?on_conflict=${onConflict}`,
        {
            method: "POST",
            headers: {
                apikey: cfg.key,
                Authorization: `Bearer ${cfg.key}`,
                "Content-Type": "application/json",
                Prefer: "resolution=merge-duplicates,return=minimal"
            },
            body: JSON.stringify(rows)
        }
    );
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Supabase ${table} ${response.status} ${text.slice(0, 240)}`);
    }
    return { remote: true };
}

function toArtistRow(artist) {
    return {
        provider: artist.provider,
        provider_id: artist.providerId,
        name: artist.name,
        image_url: artist.imageUrl,
        genres: artist.genres,
        country: artist.country,
        popularity: artist.popularity,
        release_count: artist.releaseCount,
        discovery_status: artist.discoveryStatus,
        first_seen: new Date().toISOString().slice(0, 10),
        provider_url: artist.providerUrl
    };
}

function toAlbumRow(album, artistName) {
    return {
        provider: album.provider,
        provider_id: album.providerId,
        artist_provider_id: album.artistProviderId,
        title: album.title,
        artist_name: artistName,
        artwork_url: album.artworkUrl,
        release_date: album.releaseDate,
        project_type: album.projectType,
        track_count: album.trackCount,
        genres: album.genres || ["Hip-Hop"],
        provider_url: album.providerUrl
    };
}

function toTrackRow(track) {
    return {
        provider: track.provider,
        provider_id: track.providerId,
        album_provider_id: track.albumProviderId,
        title: track.title,
        track_number: track.trackNumber,
        duration: track.duration,
        explicit: track.explicit
    };
}

function albumKey(album) {
    return `${album.provider}:${album.providerId}`;
}

export async function importBatch(options = {}) {
    const provider = createDeezerProvider();
    const limit = options.artistLimit || 25;
    const checkpoint = readJson(CHECKPOINT, emptyCheckpoint());
    checkpoint.status = "running";
    const page = await provider.listHipHopArtists(checkpoint.artistIndex, limit);
    checkpoint.artistTotal = page.total || checkpoint.artistTotal;

    for (const artist of page.artists) {
        const artistKey = `${artist.provider}:${artist.providerId}`;
        if (checkpoint.seenArtists[artistKey]) {
            checkpoint.duplicates += 1;
            continue;
        }
        try {
            const albums = await provider.getArtistAlbums(artist.providerId);
            const freshAlbums = [];
            for (const album of albums) {
                const key = albumKey(album);
                if (checkpoint.seenAlbums[key]) {
                    checkpoint.duplicates += 1;
                    continue;
                }
                checkpoint.seenAlbums[key] = 1;
                freshAlbums.push(album);
                let tracks = [];
                try {
                    tracks = await provider.getAlbumTracks(album.providerId);
                } catch (error) {
                    checkpoint.errors += 1;
                    checkpoint.lastError = String(error.message || error);
                }
                checkpoint.tracks += tracks.length;
                await upsert("tracks", tracks.map(toTrackRow), "provider,provider_id");
            }
            artist.releaseCount = albums.length;
            artist.discoveryStatus = albums.length <= 2 ? "new" : albums.length <= 6 ? "emerging" : "established";
            await upsert("artists", [toArtistRow(artist)], "provider,provider_id");
            await upsert(
                "albums",
                freshAlbums.map(album => toAlbumRow(album, artist.name)),
                "provider,provider_id"
            );
            checkpoint.seenArtists[artistKey] = 1;
            checkpoint.artists += 1;
            checkpoint.albums += freshAlbums.length;
        } catch (error) {
            checkpoint.errors += 1;
            checkpoint.lastError = String(error.message || error);
        }
        writeJson(CHECKPOINT, checkpoint);
    }

    checkpoint.artistIndex = page.next == null ? checkpoint.artistIndex : page.next;
    checkpoint.status = page.next == null ? "complete" : "paused";
    const progress = checkpoint.artistTotal
        ? Math.min(100, Math.round((checkpoint.artistIndex / checkpoint.artistTotal) * 100))
        : 0;
    checkpoint.progress = progress;
    writeJson(CHECKPOINT, checkpoint);
    await upsert("catalog_jobs", [{
        id: "initial",
        status: checkpoint.status,
        checkpoint,
        stats: {
            artists: checkpoint.artists,
            albums: checkpoint.albums,
            tracks: checkpoint.tracks,
            duplicates: checkpoint.duplicates,
            errors: checkpoint.errors,
            progress
        }
    }], "id");
    return checkpoint;
}

function bucketRelease(album, today) {
    if (!album.releaseDate) return "recent";
    const released = new Date(album.releaseDate);
    const start = new Date(today);
    start.setHours(0, 0, 0, 0);
    const day = 86400000;
    const age = start.getTime() - new Date(released.toISOString().slice(0, 10)).getTime();
    if (age <= 0 && age > -day) return "today";
    if (age >= 0 && age < 7 * day) return "week";
    return "recent";
}

export async function dailySync() {
    const provider = createDeezerProvider();
    const checkpoint = readJson(CHECKPOINT, emptyCheckpoint());
    const stats = {
        newProjects: 0,
        newArtists: 0,
        updatedArtists: 0,
        duplicates: 0,
        errors: 0,
        status: "success",
        ranAt: new Date().toISOString()
    };
    let releases = [];
    try {
        releases = await provider.recentHipHopReleases();
    } catch (error) {
        stats.status = "error";
        stats.errors += 1;
        stats.lastError = String(error.message || error);
    }

    const today = [];
    const week = [];
    const recent = [];
    const artists = new Map();
    const now = new Date();

    for (const album of releases) {
        const key = albumKey(album);
        const known = Boolean(checkpoint.seenAlbums[key]);
        if (known) stats.duplicates += 1;
        else {
            checkpoint.seenAlbums[key] = 1;
            stats.newProjects += 1;
            try {
                await upsert("albums", [toAlbumRow(album, album.artistName)], "provider,provider_id");
            } catch (error) {
                stats.errors += 1;
                stats.lastError = String(error.message || error);
            }
        }
        const card = {
            provider: album.provider,
            providerId: album.providerId,
            title: album.title,
            artist: album.artistName,
            cover: album.artworkUrl,
            releaseDate: album.releaseDate,
            projectType: album.projectType,
            trackCount: album.trackCount,
            genres: album.genres
        };
        const bucket = bucketRelease(album, now);
        if (bucket === "today") today.push(card);
        else if (bucket === "week") week.push(card);
        else recent.push(card);

        if (album.artistProviderId && !artists.has(album.artistProviderId)) {
            const artistKey = `deezer:${album.artistProviderId}`;
            const isNew = !checkpoint.seenArtists[artistKey];
            if (isNew) {
                checkpoint.seenArtists[artistKey] = 1;
                stats.newArtists += 1;
            } else {
                stats.updatedArtists += 1;
            }
            artists.set(album.artistProviderId, {
                providerId: album.artistProviderId,
                name: album.artistName,
                image: "",
                genres: ["Hip-Hop"],
                latestProject: album.title,
                releaseDate: album.releaseDate,
                discoveryStatus: isNew ? "new" : "established"
            });
        }
    }

    const discovery = {
        generatedAt: stats.ranAt,
        droppedToday: today.slice(0, 24),
        thisWeek: week.slice(0, 24),
        recent: recent.slice(0, 24),
        newArtists: [...artists.values()].filter(artist => artist.discoveryStatus === "new").slice(0, 24),
        stats
    };
    writeJson(DISCOVERY, discovery);
    writeJson(CHECKPOINT, checkpoint);
    try {
        await upsert("catalog_jobs", [{
            id: "daily",
            status: stats.status,
            checkpoint: { lastSync: stats.ranAt },
            stats
        }], "id");
    } catch (error) {
        stats.errors += 1;
        stats.lastError = String(error.message || error);
    }
    return { discovery, stats };
}

export function readStatus() {
    const checkpoint = readJson(CHECKPOINT, emptyCheckpoint());
    const discovery = readJson(DISCOVERY, null);
    return {
        import: checkpoint,
        lastSync: discovery && discovery.stats ? discovery.stats : null
    };
}

const isCli = process.argv[1] && process.argv[1].endsWith("pipeline.mjs");
const command = isCli ? process.argv[2] : "";
if (command === "import") {
    const batches = Number(process.argv[3] || 1);
    let last;
    for (let i = 0; i < batches; i += 1) {
        last = await importBatch({ artistLimit: 10 });
        console.log(JSON.stringify({
            status: last.status,
            progress: last.progress,
            artists: last.artists,
            albums: last.albums,
            tracks: last.tracks,
            errors: last.errors
        }));
        if (last.status === "complete") break;
    }
} else if (command === "daily") {
    const result = await dailySync();
    console.log(JSON.stringify(result.stats));
} else if (command === "status") {
    console.log(JSON.stringify(readStatus(), null, 2));
}
