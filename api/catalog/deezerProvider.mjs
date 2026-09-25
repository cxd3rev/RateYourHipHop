const DEEZER = "https://api.deezer.com";
const HIPHOP_GENRE_ID = 116;

const BLOCKED = /\b(pop|rock|country|classical|metal|jazz|edm|house|techno|k-pop|karaoke)\b/i;
const HIPHOP = /\b(hip[\s-]?hop|rap|trap|drill|grime|boom[\s-]?bap|plugg|rage|phonk|cloud rap|emo rap)\b/i;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function getJson(url, attempt = 0) {
    const response = await fetch(url, {
        headers: { "User-Agent": "RatedCatalog/1.0" }
    });
    if (response.status === 429 && attempt < 5) {
        await sleep(2000 * (attempt + 1));
        return getJson(url, attempt + 1);
    }
    if (!response.ok) {
        throw new Error(`Deezer ${response.status} ${url}`);
    }
    const data = await response.json();
    if (data && data.error && data.error.code === 4 && attempt < 5) {
        await sleep(2000 * (attempt + 1));
        return getJson(url, attempt + 1);
    }
    return data;
}

function isHipHop(text) {
    const value = String(text || "");
    if (HIPHOP.test(value)) {
        return true;
    }
    if (BLOCKED.test(value) && !HIPHOP.test(value)) {
        return false;
    }
    return null;
}

function projectType(recordType) {
    const kind = String(recordType || "album").toLowerCase();
    if (kind === "ep") return "ep";
    if (kind === "single") return "single";
    if (kind === "compile") return "compilation";
    return "album";
}

function artistStatus(artist, known) {
    const albums = Number(artist.nb_album || 0);
    const fans = Number(artist.nb_fan || 0);
    if (!known && albums <= 2) return "new";
    if (albums <= 6 && fans < 100000) return "emerging";
    return "established";
}

export function createDeezerProvider() {
    return {
        name: "deezer",

        async searchArtists(query) {
            const data = await getJson(
                `${DEEZER}/search/artist?q=${encodeURIComponent(query)}&limit=10`
            );
            return (data.data || []).map(normalizeArtist);
        },

        async listHipHopArtists(index = 0, limit = 50) {
            const data = await getJson(
                `${DEEZER}/genre/${HIPHOP_GENRE_ID}/artists?index=${index}&limit=${limit}`
            );
            return {
                artists: (data.data || []).map(normalizeArtist),
                next: data.next ? index + (data.data || []).length : null,
                total: data.total || null
            };
        },

        async getArtistAlbums(artistId) {
            const albums = [];
            let url = `${DEEZER}/artist/${artistId}/albums?limit=50`;
            let guard = 0;
            while (url && guard < 8) {
                const data = await getJson(url);
                for (const row of data.data || []) {
                    const type = projectType(row.record_type);
                    if (type === "single" || type === "compilation") continue;
                    const genreText = row.genre_id === HIPHOP_GENRE_ID ? "Hip-Hop" : "";
                    const verdict = isHipHop(`${genreText} ${row.title}`);
                    if (verdict === false && row.genre_id && row.genre_id !== HIPHOP_GENRE_ID) {
                        continue;
                    }
                    albums.push({
                        provider: "deezer",
                        providerId: String(row.id),
                        title: row.title,
                        artworkUrl: row.cover_xl || row.cover_big || row.cover_medium || "",
                        releaseDate: row.release_date || null,
                        projectType: type,
                        trackCount: row.nb_tracks || null,
                        genres: ["Hip-Hop"],
                        providerUrl: row.link || `https://www.deezer.com/album/${row.id}`,
                        artistProviderId: String(artistId)
                    });
                }
                url = data.next || null;
                guard += 1;
                await sleep(350);
            }
            return albums;
        },

        async getAlbumTracks(albumId) {
            const data = await getJson(`${DEEZER}/album/${albumId}/tracks?limit=100`);
            return (data.data || []).map((track, index) => ({
                provider: "deezer",
                providerId: String(track.id),
                albumProviderId: String(albumId),
                title: track.title,
                trackNumber: track.track_position || index + 1,
                duration: track.duration || null,
                explicit: Boolean(track.explicit_lyrics)
            }));
        },

        async recentHipHopReleases() {
            const data = await getJson(`${DEEZER}/chart/${HIPHOP_GENRE_ID}/albums?limit=40`);
            const rows = (data.data || []).filter(row => projectType(row.record_type) !== "single");
            const detailed = [];
            for (const row of rows.slice(0, 20)) {
                try {
                    const album = await getJson(`${DEEZER}/album/${row.id}`);
                    await sleep(300);
                    detailed.push({
                        provider: "deezer",
                        providerId: String(album.id || row.id),
                        title: album.title || row.title,
                        artistName: (album.artist && album.artist.name) || (row.artist && row.artist.name) || "",
                        artistProviderId: album.artist ? String(album.artist.id) : (row.artist ? String(row.artist.id) : ""),
                        artworkUrl: album.cover_xl || row.cover_xl || row.cover_medium || "",
                        releaseDate: album.release_date || null,
                        projectType: projectType(album.record_type || row.record_type),
                        trackCount: album.nb_tracks || row.nb_tracks || null,
                        genres: ["Hip-Hop"],
                        providerUrl: album.link || row.link || ""
                    });
                } catch {
                    detailed.push({
                        provider: "deezer",
                        providerId: String(row.id),
                        title: row.title,
                        artistName: (row.artist && row.artist.name) || "",
                        artistProviderId: row.artist ? String(row.artist.id) : "",
                        artworkUrl: row.cover_xl || row.cover_medium || "",
                        releaseDate: null,
                        projectType: projectType(row.record_type),
                        trackCount: row.nb_tracks || null,
                        genres: ["Hip-Hop"],
                        providerUrl: row.link || ""
                    });
                }
            }
            return detailed;
        }
    };
}

function normalizeArtist(row) {
    return {
        provider: "deezer",
        providerId: String(row.id),
        name: row.name,
        imageUrl: row.picture_xl || row.picture_big || row.picture_medium || "",
        genres: ["Hip-Hop"],
        country: null,
        popularity: row.nb_fan || null,
        releaseCount: row.nb_album || 0,
        providerUrl: row.link || `https://www.deezer.com/artist/${row.id}`,
        discoveryStatus: artistStatus(row, false)
    };
}

export { isHipHop, artistStatus, HIPHOP_GENRE_ID };
