/* =====================================================
   RATED UI — discovery, profile posters, inbox, saves
   Extends existing script.js rating / follow / album APIs
===================================================== */

let homeTab = "albums";
let discoveryIndex = 0;
let discoveryList = [];
let discoveryWindowStart = 0;
const DISCOVERY_WINDOW = 7;
let discoveryColorsCache = new Map();
let profileSort = localStorage.getItem("profileSort") || "newest";
let profileCollectionTab = "albums";
let searchOpen = false;
let tracklistPanelOpen = false;

/* ---------- local saves (independent of rating) ---------- */

function getSaveKey(kind) {
    if (!currentUser) {
        return null;
    }
    return `ratedSaved${kind}_${currentUser.id}`;
}

function readSaveList(kind) {
    const key = getSaveKey(kind);
    if (!key) {
        return [];
    }
    try {
        const raw = JSON.parse(localStorage.getItem(key) || "[]");
        return Array.isArray(raw) ? raw : [];
    } catch (error) {
        return [];
    }
}

function writeSaveList(kind, list) {
    const key = getSaveKey(kind);
    if (!key) {
        return;
    }
    localStorage.setItem(key, JSON.stringify(list));
}

function isAlbumCollected(albumId) {
    return readSaveList("Albums").includes(Number(albumId));
}

function toggleCollectAlbum(albumId, event) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }
    if (!currentUser) {
        openAuth();
        return false;
    }
    const id = Number(albumId);
    let list = readSaveList("Albums");
    if (list.includes(id)) {
        list = list.filter(x => x !== id);
    } else {
        list.push(id);
        pushInboxEvent({
            type: "save",
            albumId: id,
            userId: currentUser.id,
            at: Date.now()
        });
    }
    writeSaveList("Albums", list);
    refreshCollectButtons(id);
    return list.includes(id);
}

function isArtistSaved(name) {
    return readSaveList("Artists").includes(name);
}

function toggleSaveArtist(name, event) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }
    if (!currentUser) {
        openAuth();
        return;
    }
    let list = readSaveList("Artists");
    if (list.includes(name)) {
        list = list.filter(x => x !== name);
    } else {
        list.push(name);
    }
    writeSaveList("Artists", list);
    if (typeof renderProfilePage === "function") {
        renderProfileCollections();
    }
}

function isGenreSaved(tag) {
    return readSaveList("Genres").includes(tag);
}

function toggleSaveGenre(tag, event) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }
    if (!currentUser) {
        openAuth();
        return;
    }
    let list = readSaveList("Genres");
    if (list.includes(tag)) {
        list = list.filter(x => x !== tag);
    } else {
        list.push(tag);
    }
    writeSaveList("Genres", list);
    if (typeof renderProfilePage === "function") {
        renderProfileCollections();
    }
}

function refreshCollectButtons(albumId) {
    const saved = isAlbumCollected(albumId);
    document.querySelectorAll(`[data-collect-album="${albumId}"]`).forEach(btn => {
        btn.classList.toggle("is-saved", saved);
        btn.setAttribute("aria-pressed", saved ? "true" : "false");
        btn.textContent = saved ? "Saved" : "Save";
    });
}

/* ---------- inbox activity (local) ---------- */

function getInboxKey() {
    if (!currentUser) {
        return "ratedInbox_guest";
    }
    return `ratedInbox_${currentUser.id}`;
}

function readInbox() {
    try {
        const raw = JSON.parse(localStorage.getItem(getInboxKey()) || "[]");
        return Array.isArray(raw) ? raw : [];
    } catch (error) {
        return [];
    }
}

function pushInboxEvent(event) {
    const list = readInbox();
    list.unshift(event);
    localStorage.setItem(getInboxKey(), JSON.stringify(list.slice(0, 80)));
}

function showInbox() {
    hideAllPages();
    setActiveNav("navInbox");
    const page = document.getElementById("inboxPage");
    if (page) {
        page.classList.remove("hidden");
    }
    renderInbox();
}

function renderInbox() {
    const box = document.getElementById("inboxFeed");
    if (!box) {
        return;
    }

    const events = [];

    getFollowIds().forEach(userId => {
        const user = getUserById(userId);
        if (!user) {
            return;
        }
        const ratings = getUserRatingsMap(userId);
        Object.keys(ratings || {}).forEach(albumId => {
            const album = albumById.get(Number(albumId));
            if (!album) {
                return;
            }
            const score = getUserAlbumRating(userId, Number(albumId));
            if (score === null) {
                return;
            }
            events.push({
                type: "friend-rating",
                userId,
                albumId: Number(albumId),
                score,
                at: Number(albumId) * 1000
            });
        });
    });

    readInbox().forEach(ev => events.push(ev));

    events.sort((a, b) => (b.at || 0) - (a.at || 0));

    if (!events.length) {
        box.innerHTML = `
            <div class="empty-state">
                No activity yet. Follow friends and rate albums to fill your inbox.
            </div>
        `;
        return;
    }

    box.innerHTML = events.slice(0, 40).map(ev => {
        if (ev.type === "friend-rating" || ev.type === "rating") {
            const user = getUserById(ev.userId) || currentUser;
            const album = albumById.get(ev.albumId);
            if (!album) {
                return "";
            }
            const name = user ? user.username : "Someone";
            const scoreText = ev.score != null ? Number(ev.score).toFixed(1) : "—";
            return `
                <button type="button" class="inbox-row" onclick="openAlbum(${album.id}, false, false)">
                    <img src="${coverSrc(album.cover, 120)}" alt="" loading="lazy" width="48" height="48">
                    <div>
                        <strong>${escapeHtml(name)}</strong> rated
                        <em>${escapeHtml(album.title)}</em>
                        <span class="inbox-score" style="${scoreColorStyle(ev.score)}">${scoreText}</span>
                    </div>
                </button>
            `;
        }
        if (ev.type === "save") {
            const album = albumById.get(ev.albumId);
            if (!album) {
                return "";
            }
            return `
                <button type="button" class="inbox-row" onclick="openAlbum(${album.id})">
                    <img src="${coverSrc(album.cover, 120)}" alt="" loading="lazy" width="48" height="48">
                    <div>
                        <strong>You</strong> saved
                        <em>${escapeHtml(album.title)}</em>
                    </div>
                </button>
            `;
        }
        if (ev.type === "follow-request") {
            const user = getUserById(ev.userId);
            if (!user) {
                return "";
            }
            return `
                <div class="inbox-row">
                    ${friendAvatarMarkup(user, "inbox-avatar")}
                    <div>
                        <strong>${escapeHtml(user.username)}</strong> follow activity
                    </div>
                    ${followButtonMarkup(user.id)}
                </div>
            `;
        }
        return "";
    }).join("");
}

/* ---------- home tabs ---------- */

function setHomeTab(tab) {
    homeTab = tab;

    document.querySelectorAll(".home-tab").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.tab === tab);
    });

    const discovery = document.getElementById("discoveryFeed");
    const friendsFeed = document.getElementById("homeFriendsFeed");
    const best = document.getElementById("bestAlbumsPanel");

    if (discovery) {
        discovery.classList.toggle("hidden", tab !== "albums");
    }
    if (friendsFeed) {
        friendsFeed.classList.toggle("hidden", tab !== "friends");
    }
    if (best) {
        best.classList.toggle("hidden", tab !== "best");
    }

    if (tab === "albums") {
        renderDiscoveryFeed();
    } else if (tab === "friends") {
        renderHomeFriendsActivity();
    } else if (tab === "best") {
        renderBestAlbums();
    }
}

function renderHomeFriendsActivity() {
    const box = document.getElementById("homeFriendsFeed");
    if (!box) {
        return;
    }

    if (!currentUser) {
        box.innerHTML = `
            <div class="empty-state">
                Log in and follow people to see friend activity.
            </div>
        `;
        return;
    }

    const rows = [];
    getFollowIds().forEach(userId => {
        const user = getUserById(userId);
        if (!user) {
            return;
        }
        getUserTopAlbums(userId, 3).forEach(entry => {
            rows.push({ user, album: entry.album, score: entry.score });
        });
    });

    if (!rows.length) {
        box.innerHTML = `
            <div class="empty-state">
                No friend ratings yet. Follow someone from Friends.
            </div>
        `;
        return;
    }

    box.innerHTML = rows.map(({ user, album, score }) => `
        <button type="button" class="activity-card" onclick="openAlbum(${album.id}, false, true)">
            <img src="${coverSrc(album.cover, 250)}" alt="" loading="lazy" width="72" height="72">
            <div class="activity-copy">
                <span class="activity-user">${escapeHtml(user.username)}</span>
                <strong>${escapeHtml(album.title)}</strong>
                <span class="activity-artist">${escapeHtml(album.artist)}</span>
                <span class="activity-score" style="${scoreColorStyle(score)}">${score.toFixed(1)}</span>
            </div>
        </button>
    `).join("");
}

function renderBestAlbums() {
    const box = document.getElementById("bestAlbumsGrid");
    if (!box) {
        return;
    }

    const ranked = albums
        .map(album => ({
            album,
            score: getAlbumGlobalRating(album.id)
        }))
        .filter(entry => entry.score !== null)
        .sort((a, b) => b.score - a.score)
        .slice(0, 60);

    if (!ranked.length) {
        box.innerHTML = `<div class="empty-state">No community scores yet.</div>`;
        return;
    }

    box.innerHTML = ranked
        .map((entry, index) => createAlbumCard(entry.album, false, index + 1))
        .join("");
}

/* ---------- discovery feed ---------- */

function buildDiscoveryList(source) {
    const list = (source || albums).slice();
    // Prefer unrated first for discovery feel, then shuffle lightly by id
    list.sort((a, b) => {
        const ra = getAlbumRating(a.id) === null ? 0 : 1;
        const rb = getAlbumRating(b.id) === null ? 0 : 1;
        if (ra !== rb) {
            return ra - rb;
        }
        return ((a.id * 17) % 97) - ((b.id * 17) % 97);
    });
    return list;
}

function renderDiscoveryFeed(list) {
    const feed = document.getElementById("discoveryFeed");
    if (!feed) {
        return;
    }

    if (list) {
        discoveryList = list;
        discoveryIndex = 0;
        discoveryWindowStart = 0;
    } else if (!discoveryList.length) {
        discoveryList = buildDiscoveryList();
    }

    if (!discoveryList.length) {
        feed.innerHTML = `<div class="empty-state discovery-empty">No albums found.</div>`;
        return;
    }

    const start = Math.max(0, discoveryIndex - 2);
    const end = Math.min(discoveryList.length, start + DISCOVERY_WINDOW);
    discoveryWindowStart = start;

    const slice = discoveryList.slice(start, end);

    feed.innerHTML = slice.map((album, i) => {
        const absoluteIndex = start + i;
        return createDiscoveryCard(album, absoluteIndex);
    }).join("");

    // Jump scroll position to current card
    requestAnimationFrame(() => {
        const current = feed.querySelector(`[data-discovery-index="${discoveryIndex}"]`);
        if (current) {
            current.scrollIntoView({ block: "nearest", behavior: "instant" in window ? "instant" : "auto" });
        }
        slice.forEach(album => extractCoverPalette(album));
    });
}

function createDiscoveryCard(album, index) {
    const yours = getAlbumRating(album.id);
    const community = getAlbumGlobalRating(album.id);
    const tags = getAlbumGenreTags(album);
    const saved = isAlbumCollected(album.id);
    return `
        <article
            class="discovery-card"
            data-discovery-index="${index}"
            data-album-id="${album.id}"
        >
            <div class="discovery-stage">
                <img
                    class="discovery-cover"
                    src="${coverSrc(album.cover, 500)}"
                    alt="${escapeHtml(album.title)}"
                    loading="${Math.abs(index - discoveryIndex) <= 1 ? "eager" : "lazy"}"
                    decoding="async"
                    width="500"
                    height="500"
                >
                <div class="discovery-meta">
                    <h2 class="discovery-title">${escapeHtml(album.title)}</h2>
                    <p class="discovery-artist">
                        ${
                            splitArtistNames(album.artist)
                                .map(name => `
                                    <span
                                        class="artist-link"
                                        data-artist="${encodeURIComponent(name)}"
                                        onclick="openArtistFromEvent(event)"
                                    >${escapeHtml(name)}</span>
                                `)
                                .join(" & ")
                        }
                    </p>
                    <div class="discovery-tags">
                        ${tags.map(tag => `
                            <button
                                type="button"
                                class="genre-chip ${isGenreSaved(tag) ? "is-saved" : ""}"
                                onclick="toggleSaveGenre('${tag.replace(/'/g, "\\'")}', event)"
                            >#${escapeHtml(tag)}</button>
                        `).join("")}
                    </div>
                    <div class="discovery-scores">
                        <div>
                            <span class="small-label">YOUR RATING</span>
                            <strong class="discovery-you" ${yours !== null ? `style="${scoreColorStyle(yours)}"` : ""}>
                                ${yours !== null ? yours.toFixed(1) : "—"}
                            </strong>
                        </div>
                        <div>
                            <span class="small-label">COMMUNITY</span>
                            <strong class="discovery-community" ${community !== null ? `style="${scoreColorStyle(community)}"` : ""}>
                                ${community !== null ? community.toFixed(1) : "—"}
                            </strong>
                        </div>
                    </div>
                    <div class="discovery-actions">
                        <button
                            type="button"
                            class="discovery-primary"
                            onclick="openAlbumFromDiscovery(${album.id})"
                        >Rate tracks</button>
                        <button
                            type="button"
                            class="discovery-save ${saved ? "is-saved" : ""}"
                            data-collect-album="${album.id}"
                            aria-pressed="${saved ? "true" : "false"}"
                            onclick="toggleCollectAlbum(${album.id}, event)"
                        >${saved ? "Saved" : "Save"}</button>
                    </div>
                    <p class="discovery-hint">Swipe up for next · open tracks to rate</p>
                </div>
            </div>
        </article>
    `;
}

function openAlbumFromDiscovery(albumId) {
    openAlbum(albumId, false, false);
}

function setupDiscoveryFeed() {
    const feed = document.getElementById("discoveryFeed");
    if (!feed || feed.dataset.bound === "1") {
        return;
    }
    feed.dataset.bound = "1";

    let scrollTick = null;
    feed.addEventListener("scroll", () => {
        if (scrollTick) {
            return;
        }
        scrollTick = requestAnimationFrame(() => {
            scrollTick = null;
            const cards = [...feed.querySelectorAll(".discovery-card")];
            if (!cards.length) {
                return;
            }
            const mid = feed.scrollTop + feed.clientHeight / 2;
            let best = cards[0];
            let bestDist = Infinity;
            cards.forEach(card => {
                const center = card.offsetTop + card.offsetHeight / 2;
                const dist = Math.abs(center - mid);
                if (dist < bestDist) {
                    bestDist = dist;
                    best = card;
                }
            });
            const idx = Number(best.dataset.discoveryIndex);
            if (!Number.isNaN(idx) && idx !== discoveryIndex) {
                discoveryIndex = idx;
                // Rebuild window when near edges
                const localPos = discoveryIndex - discoveryWindowStart;
                if (localPos <= 1 || localPos >= DISCOVERY_WINDOW - 2) {
                    const keepId = discoveryList[discoveryIndex]?.id;
                    renderDiscoveryFeed();
                    const again = feed.querySelector(`[data-album-id="${keepId}"]`);
                    if (again) {
                        again.scrollIntoView({ block: "nearest" });
                    }
                }
            }
        });
    }, { passive: true });

    // Horizontal swipe to open tracklist
    let touchX = null;
    let touchY = null;
    feed.addEventListener("touchstart", event => {
        const t = event.changedTouches[0];
        touchX = t.clientX;
        touchY = t.clientY;
    }, { passive: true });

    feed.addEventListener("touchend", event => {
        if (touchX === null) {
            return;
        }
        const t = event.changedTouches[0];
        const dx = t.clientX - touchX;
        const dy = t.clientY - touchY;
        touchX = null;
        touchY = null;
        if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.4 && dx < 0) {
            const album = discoveryList[discoveryIndex];
            if (album) {
                openAlbum(album.id);
            }
        }
    }, { passive: true });
}

function extractCoverPalette(album) {
    if (!album || discoveryColorsCache.has(album.id)) {
        return Promise.resolve(discoveryColorsCache.get(album.id));
    }

    return new Promise(resolve => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            try {
                const canvas = document.createElement("canvas");
                const size = 24;
                canvas.width = size;
                canvas.height = size;
                const ctx = canvas.getContext("2d", { willReadFrequently: true });
                ctx.drawImage(img, 0, 0, size, size);
                const data = ctx.getImageData(0, 0, size, size).data;
                let r = 0;
                let g = 0;
                let b = 0;
                let n = 0;
                const buckets = new Map();
                for (let i = 0; i < data.length; i += 4) {
                    const pr = data[i];
                    const pg = data[i + 1];
                    const pb = data[i + 2];
                    const lum = 0.2126 * pr + 0.7152 * pg + 0.0722 * pb;
                    if (lum < 18 || lum > 240) {
                        continue;
                    }
                    r += pr;
                    g += pg;
                    b += pb;
                    n += 1;
                    const key = `${pr >> 5},${pg >> 5},${pb >> 5}`;
                    buckets.set(key, (buckets.get(key) || 0) + 1);
                }
                if (!n) {
                    const fallback = { glow: "rgba(40,40,40,0.55)", swatches: ["#111", "#333", "#666", "#999", "#ccc"] };
                    discoveryColorsCache.set(album.id, fallback);
                    resolve(fallback);
                    return;
                }
                r = Math.round(r / n);
                g = Math.round(g / n);
                b = Math.round(b / n);

                const swatches = [...buckets.entries()]
                    .sort((a, b2) => b2[1] - a[1])
                    .slice(0, 5)
                    .map(([key]) => {
                        const [rr, gg, bb] = key.split(",").map(v => Number(v) * 8 + 4);
                        return `rgb(${rr},${gg},${bb})`;
                    });

                while (swatches.length < 5) {
                    swatches.push(`rgb(${r},${g},${b})`);
                }

                const palette = {
                    glow: `rgba(${r},${g},${b},0.45)`,
                    swatches,
                    rgb: { r, g, b }
                };
                discoveryColorsCache.set(album.id, palette);
                resolve(palette);
            } catch (error) {
                const fallback = { glow: "rgba(40,40,40,0.55)", swatches: ["#111", "#333", "#666", "#999", "#ccc"] };
                discoveryColorsCache.set(album.id, fallback);
                resolve(fallback);
            }
        };
        img.onerror = () => {
            const fallback = { glow: "rgba(40,40,40,0.55)", swatches: ["#111", "#333", "#666", "#999", "#ccc"] };
            discoveryColorsCache.set(album.id, fallback);
            resolve(fallback);
        };
        img.src = coverSrc(album.cover, 120);
    });
}

/* ---------- taste / analytics hooks ---------- */

function getRatingDistribution(userId) {
    const map = userId ? getUserRatingsMap(userId) : guestRatings;
    const buckets = { "0-2": 0, "2-4": 0, "4-6": 0, "6-8": 0, "8-10": 0 };
    Object.keys(map || {}).forEach(albumId => {
        const score = getAlbumAverageFromMap(Number(albumId), map);
        if (score === null) {
            return;
        }
        if (score < 2) buckets["0-2"] += 1;
        else if (score < 4) buckets["2-4"] += 1;
        else if (score < 6) buckets["4-6"] += 1;
        else if (score < 8) buckets["6-8"] += 1;
        else buckets["8-10"] += 1;
    });
    return buckets;
}

function getTastePercentages(userId) {
    const map = userId ? getUserRatingsMap(userId) : guestRatings;
    const genreCounts = {};
    let total = 0;
    Object.keys(map || {}).forEach(albumId => {
        const album = albumById.get(Number(albumId));
        if (!album || getAlbumAverageFromMap(Number(albumId), map) === null) {
            return;
        }
        getAlbumGenreTags(album).forEach(tag => {
            if (tag === "Hip-Hop" || tag === "Rap") {
                return;
            }
            genreCounts[tag] = (genreCounts[tag] || 0) + 1;
            total += 1;
        });
    });
    if (!total) {
        return [];
    }
    return Object.entries(genreCounts)
        .map(([tag, count]) => ({
            tag,
            count,
            pct: Math.round((count / total) * 100)
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);
}

function getRecentlyRatedAlbums(limit = 12) {
    return albums
        .filter(album => getAlbumRating(album.id) !== null)
        .slice()
        .sort((a, b) => b.id - a.id)
        .slice(0, limit);
}

function getMostDivisiveAlbums(limit = 12) {
    // Local stand-in: albums where user score diverges from community
    return albums
        .map(album => {
            const yours = getAlbumRating(album.id);
            const community = getAlbumGlobalRating(album.id);
            if (yours === null || community === null) {
                return null;
            }
            return { album, delta: Math.abs(yours - community), yours, community };
        })
        .filter(Boolean)
        .sort((a, b) => b.delta - a.delta)
        .slice(0, limit);
}

function getTrendingAlbums(limit = 12) {
    return albums
        .map(album => ({
            album,
            score: getAlbumGlobalRating(album.id)
        }))
        .filter(entry => entry.score !== null)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
}

function getFriendComparison(albumId) {
    const yours = getAlbumRating(albumId);
    return getFollowIds().map(userId => {
        const user = getUserById(userId);
        const score = getUserAlbumRating(userId, albumId);
        return { user, score, delta: yours !== null && score !== null ? yours - score : null };
    }).filter(entry => entry.user && entry.score !== null);
}

/* ---------- profile ---------- */

function showProfile() {
    if (!currentUser) {
        openAuth();
        return;
    }
    hideAllPages();
    setActiveNav("navProfile");
    const page = document.getElementById("profilePage");
    if (page) {
        page.classList.remove("hidden");
    }
    renderProfilePage();
}

function getProfileBioKey() {
    return currentUser ? `ratedBio_${currentUser.id}` : null;
}

function getProfileBio() {
    const key = getProfileBioKey();
    if (!key) {
        return "";
    }
    return localStorage.getItem(key) || "";
}

function saveProfileBio() {
    const key = getProfileBioKey();
    const input = document.getElementById("profileBioInput");
    if (!key || !input) {
        return;
    }
    localStorage.setItem(key, input.value.slice(0, 280));
    const display = document.getElementById("profileBioDisplay");
    if (display) {
        display.textContent = input.value.trim() || "Add a bio.";
    }
    closeProfileEdit();
}

function openProfileEdit() {
    const panel = document.getElementById("profileEditPanel");
    const input = document.getElementById("profileBioInput");
    if (panel) {
        panel.classList.remove("hidden");
    }
    if (input) {
        input.value = getProfileBio();
        input.focus();
    }
}

function closeProfileEdit() {
    const panel = document.getElementById("profileEditPanel");
    if (panel) {
        panel.classList.add("hidden");
    }
}

function renderProfilePage() {
    if (!currentUser) {
        return;
    }

    const avatar = document.getElementById("profileAvatar");
    const name = document.getElementById("profileUsername");
    const bio = document.getElementById("profileBioDisplay");
    const friendsRow = document.getElementById("profileFriendsRow");
    const taste = document.getElementById("profileTasteTags");

    if (avatar) {
        if (currentUser.profile_picture) {
            avatar.innerHTML = `<img src="${currentUser.profile_picture}" alt="">`;
        } else {
            avatar.innerHTML = `<img src="assets/rated-icon-light.png?v=30" alt="RATED">`;
        }
    }
    if (name) {
        name.textContent = currentUser.username;
    }
    if (bio) {
        bio.textContent = getProfileBio().trim() || "Add a bio.";
    }

    if (friendsRow) {
        const ids = getFollowIds().slice(0, 4);
        const more = Math.max(0, getFollowIds().length - 4);
        friendsRow.innerHTML = ids.map(id => {
            const user = getUserById(id);
            if (!user) {
                return "";
            }
            return `
                <button type="button" class="profile-friend" onclick="openFriendProfile(${user.id})" title="${escapeHtml(user.username)}">
                    ${friendAvatarMarkup(user)}
                </button>
            `;
        }).join("") + (more
            ? `<button type="button" class="profile-friend-more" onclick="showFriends()">+${more}</button>`
            : "");
        if (!ids.length) {
            friendsRow.innerHTML = `<span class="muted">Follow friends to see them here.</span>`;
        }
    }

    if (taste) {
        const artistTags = [];
        const seenArtists = new Set();
        Object.keys(guestRatings || {}).forEach(albumId => {
            const album = albumById.get(Number(albumId));
            if (!album || getAlbumRating(Number(albumId)) === null) {
                return;
            }
            splitArtistNames(album.artist).forEach(artist => {
                if (!seenArtists.has(artist)) {
                    seenArtists.add(artist);
                    artistTags.push(artist);
                }
            });
        });

        const genreStats = {};
        Object.keys(guestRatings || {}).forEach(albumId => {
            const album = albumById.get(Number(albumId));
            if (!album || getAlbumRating(Number(albumId)) === null) {
                return;
            }
            getAlbumGenreTags(album).forEach(tag => {
                genreStats[tag] = (genreStats[tag] || 0) + 1;
            });
        });

        const genreChips = Object.entries(genreStats)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([tag, count]) =>
                `<button type="button" class="taste-chip genre" onclick="toggleSaveGenre('${tag.replace(/'/g, "\\'")}', event)">#${escapeHtml(tag)} <span>${count}</span></button>`
            )
            .join("");

        const artistChips = artistTags.slice(0, 8).map(artist =>
            `<button type="button" class="taste-chip artist" onclick="toggleSaveArtist('${artist.replace(/'/g, "\\'")}', event)">#${escapeHtml(artist)}</button>`
        ).join("");

        taste.innerHTML = (artistChips + genreChips) || `<span class="muted">Rate albums to build taste tags.</span>`;
    }

    renderProfilePosters();
    renderProfileCollections();
}

function setProfileSort(sort) {
    profileSort = sort;
    localStorage.setItem("profileSort", sort);
    document.querySelectorAll(".profile-sort-btn").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.sort === sort);
    });
    renderProfilePosters();
}

function getRatedAlbumsForProfile() {
    const rated = albums.filter(album => getAlbumRating(album.id) !== null);
    if (profileSort === "highest") {
        return rated.sort((a, b) => getAlbumRating(b.id) - getAlbumRating(a.id));
    }
    if (profileSort === "oldest") {
        return rated.sort((a, b) => a.id - b.id);
    }
    // newest rated — approximate by highest album id among rated / insertion order keys
    const order = Object.keys(guestRatings).map(Number);
    return rated.sort((a, b) => {
        const ia = order.indexOf(a.id);
        const ib = order.indexOf(b.id);
        if (ia === -1 && ib === -1) {
            return b.id - a.id;
        }
        if (ia === -1) {
            return 1;
        }
        if (ib === -1) {
            return -1;
        }
        return ib - ia;
    });
}

function createPosterCard(album, options = {}) {
    const yours = getAlbumRating(album.id);
    const community = getAlbumGlobalRating(album.id);
    const palette = discoveryColorsCache.get(album.id);
    const swatches = (palette && palette.swatches) || ["#111", "#333", "#555", "#888", "#bbb"];
    const trackCount = album.songs.length;
    const compact = trackCount > 16 ? "is-compact" : trackCount > 12 ? "is-tight" : "";

    const tracks = album.songs.map((song, index) => {
        const globalSong = getSongGlobalRating(album.id, index);
        const scoreText = globalSong !== null && globalSong !== undefined
            ? Number(globalSong).toFixed(1)
            : "—";
        return `
            <li>
                <span class="poster-track-num">${index + 1}.</span>
                <span class="poster-track-name">${escapeHtml(song)}</span>
                <span class="poster-track-score">${scoreText}</span>
            </li>
        `;
    }).join("");

    const metaBits = [];
    if (album.genre) {
        metaBits.push(`LABEL: ${escapeHtml(album.genre).toUpperCase()}`);
    }
    if (album.songs && album.songs.length) {
        metaBits.push(`${album.songs.length} TRACKS`);
    }
    if (album.year) {
        metaBits.push(`RELEASED ${album.year}`);
    }

    extractCoverPalette(album);

    return `
        <article
            class="poster-card ${compact} ${options.large ? "is-large" : ""}"
            data-poster-album="${album.id}"
            onclick="openPosterModal(${album.id})"
        >
            <div class="poster-inner">
                <img
                    class="poster-cover"
                    src="${coverSrc(album.cover, options.large ? 500 : 250)}"
                    alt="${escapeHtml(album.title)}"
                    loading="lazy"
                    decoding="async"
                    width="250"
                    height="250"
                >
                <div class="poster-body">
                    <ol class="poster-tracks">${tracks}</ol>
                    <div class="poster-side">
                        <div class="poster-swatches">
                            ${swatches.slice(0, 5).map(c => `<span style="background:${c}"></span>`).join("")}
                        </div>
                        <p class="poster-artist">${escapeHtml(album.artist)}</p>
                        <h3 class="poster-title">${escapeHtml(album.title)}</h3>
                        <div class="poster-scores">
                            <div>
                                <span>AVG</span>
                                <strong>${community !== null ? community.toFixed(1) : "—"}</strong>
                            </div>
                            <div>
                                <span>YOU</span>
                                <strong ${yours !== null ? `style="${scoreColorStyle(yours)}"` : ""}>
                                    ${yours !== null ? yours.toFixed(1) : "—"}
                                </strong>
                            </div>
                        </div>
                        <img class="poster-logo" src="assets/rated-wordmark-dark.png?v=28" alt="RATED">
                        <p class="poster-meta">${metaBits.join(" · ")}</p>
                    </div>
                </div>
            </div>
        </article>
    `;
}

function renderProfilePosters() {
    const grid = document.getElementById("profilePosterGrid");
    if (!grid) {
        return;
    }
    const rated = getRatedAlbumsForProfile();
    if (!rated.length) {
        grid.innerHTML = `<div class="empty-state">Rate an album to unlock poster cards.</div>`;
        return;
    }
    grid.innerHTML = rated.map(album => createPosterCard(album)).join("");
    rated.slice(0, 12).forEach(album => {
        extractCoverPalette(album).then(() => {
            const card = grid.querySelector(`[data-poster-album="${album.id}"]`);
            if (!card) {
                return;
            }
            const palette = discoveryColorsCache.get(album.id);
            if (!palette) {
                return;
            }
            const swatchRow = card.querySelector(".poster-swatches");
            if (swatchRow) {
                swatchRow.innerHTML = palette.swatches.slice(0, 5)
                    .map(c => `<span style="background:${c}"></span>`)
                    .join("");
            }
        });
    });
}

function openPosterModal(albumId) {
    const album = albumById.get(albumId);
    const modal = document.getElementById("posterModal");
    const body = document.getElementById("posterModalBody");
    if (!album || !modal || !body) {
        return;
    }
    body.innerHTML = createPosterCard(album, { large: true });
    const card = body.querySelector(".poster-card");
    if (card) {
        card.onclick = null;
    }
    modal.classList.remove("hidden");
    extractCoverPalette(album).then(() => {
        body.innerHTML = createPosterCard(album, { large: true });
        const again = body.querySelector(".poster-card");
        if (again) {
            again.onclick = null;
        }
    });
}

function closePosterModal() {
    const modal = document.getElementById("posterModal");
    if (modal) {
        modal.classList.add("hidden");
    }
}

function setProfileCollectionTab(tab) {
    profileCollectionTab = tab;
    document.querySelectorAll(".profile-collection-tab").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.tab === tab);
    });
    renderProfileCollections();
}

function renderProfileCollections() {
    const box = document.getElementById("profileCollections");
    if (!box) {
        return;
    }

    if (profileCollectionTab === "albums") {
        const ids = readSaveList("Albums");
        const list = ids.map(id => albumById.get(id)).filter(Boolean);
        box.innerHTML = list.length
            ? list.map((album, index) => createAlbumCard(album, false, index + 1)).join("")
            : `<div class="empty-state">No saved albums yet.</div>`;
        return;
    }

    if (profileCollectionTab === "artists") {
        const list = readSaveList("Artists");
        box.innerHTML = list.length
            ? `<div class="saved-chip-list">${list.map(name => `
                <button type="button" class="saved-chip" onclick="openArtist('${name.replace(/'/g, "\\'")}')">
                    #${escapeHtml(name)}
                </button>
            `).join("")}</div>`
            : `<div class="empty-state">Save artists from genre chips or discovery.</div>`;
        return;
    }

    const list = readSaveList("Genres");
    box.innerHTML = list.length
        ? `<div class="saved-chip-list">${list.map(tag => `
            <button type="button" class="saved-chip" onclick="searchGenreTag('${tag.replace(/'/g, "\\'")}')">
                #${escapeHtml(tag)}
            </button>
        `).join("")}</div>`
        : `<div class="empty-state">Save genres from discovery tags.</div>`;
}

function searchGenreTag(tag) {
    showHome();
    setHomeTab("albums");
    const input = document.getElementById("searchInput");
    if (input) {
        input.value = tag;
        toggleSearch(true);
        applySearch();
    }
}

/* ---------- search overlay ---------- */

function toggleSearch(force) {
    searchOpen = typeof force === "boolean" ? force : !searchOpen;
    const panel = document.getElementById("searchPanel");
    const btn = document.getElementById("searchToggle");
    if (panel) {
        panel.classList.toggle("hidden", !searchOpen);
    }
    if (btn) {
        btn.classList.toggle("active", searchOpen);
    }
    if (searchOpen) {
        const input = document.getElementById("searchInput");
        if (input) {
            input.focus();
        }
    }
}

function renderExpandedSearch(query) {
    const box = document.getElementById("searchResults");
    if (!box) {
        return false;
    }

    const q = String(query || "").toLowerCase().trim();
    if (!q) {
        box.innerHTML = "";
        box.classList.add("hidden");
        return false;
    }

    const albumHits = albums.filter(album =>
        album.title.toLowerCase().includes(q) ||
        album.artist.toLowerCase().includes(q) ||
        albumMatchesGenreQuery(album, q)
    ).slice(0, 20);

    const artistHits = [];
    const seen = new Set();
    albums.forEach(album => {
        splitArtistNames(album.artist).forEach(name => {
            if (name.toLowerCase().includes(q) && !seen.has(name)) {
                seen.add(name);
                artistHits.push(name);
            }
        });
    });

    const userHits = getPublicUsers().filter(user =>
        String(user.username || "").toLowerCase().includes(q)
    ).slice(0, 8);

    const genreHits = new Set();
    albums.slice(0, 400).forEach(album => {
        getAlbumGenreTags(album).forEach(tag => {
            if (tag.toLowerCase().includes(q)) {
                genreHits.add(tag);
            }
        });
    });

    box.classList.remove("hidden");
    box.innerHTML = `
        <section>
            <h3>Albums</h3>
            <div class="album-list search-album-list">
                ${albumHits.length ? albumHits.map((a, i) => createAlbumCard(a, false, i + 1)).join("") : "<p class='muted'>No albums</p>"}
            </div>
        </section>
        <section>
            <h3>Artists</h3>
            <div class="saved-chip-list">
                ${artistHits.slice(0, 12).map(name => `
                    <button type="button" class="saved-chip" onclick="openArtist('${name.replace(/'/g, "\\'")}')">#${escapeHtml(name)}</button>
                `).join("") || "<p class='muted'>No artists</p>"}
            </div>
        </section>
        <section>
            <h3>Users</h3>
            <div class="friends-container">
                ${userHits.length ? userHits.map(user => createFriendRow(user)).join("") : "<p class='muted'>No users</p>"}
            </div>
        </section>
        <section>
            <h3>Genres</h3>
            <div class="saved-chip-list">
                ${[...genreHits].slice(0, 12).map(tag => `
                    <button type="button" class="saved-chip" onclick="searchGenreTag('${tag.replace(/'/g, "\\'")}')">#${escapeHtml(tag)}</button>
                `).join("") || "<p class='muted'>No genres</p>"}
            </div>
        </section>
    `;

    // Also drive discovery filter when on albums tab
    if (homeTab === "albums") {
        renderDiscoveryFeed(buildDiscoveryList(albumHits.length ? albumHits : albums.filter(a =>
            a.title.toLowerCase().includes(q) ||
            a.artist.toLowerCase().includes(q) ||
            albumMatchesGenreQuery(a, q)
        )));
    }

    return true;
}

/* ---------- sticky album progress chrome ---------- */

let lastStickyScoreText = null;

function animateScoreNumber(el, nextText) {
    if (!el) {
        return;
    }
    if (el.textContent === nextText) {
        return;
    }
    el.classList.remove("score-pop");
    // reflow
    void el.offsetWidth;
    el.textContent = nextText;
    el.classList.add("score-pop");
}

function updateTrackProgressChrome() {
    if (!currentAlbum) {
        return;
    }

    const total = currentAlbum.songs.length;
    const ratings = guestRatings[currentAlbum.id] || {};
    let ratedCount = 0;
    for (let i = 0; i < total; i += 1) {
        if (ratings[i] !== undefined && ratings[i] !== null) {
            ratedCount += 1;
        }
    }

    // Include live drag value
    if (
        (isDraggingSongLine || isDraggingDial || dialWasMoved) &&
        ratings[currentSongIndex] === undefined
    ) {
        // counting only committed ratings for N / total
    }

    const live = getLiveAlbumRating(currentAlbum.id);
    const scoreText = live !== null
        ? (Math.round(live * 10) / 10).toFixed(1)
        : "—";

    const scoreEl = document.getElementById("stickyYourScore");
    const countEl = document.getElementById("stickyTrackCount");
    const statusEl = document.getElementById("stickyAlbumStatus");
    const bar = document.getElementById("albumProgressBar");

    if (scoreEl) {
        animateScoreNumber(scoreEl, scoreText);
        applyScoreColor(scoreEl, live);
    }
    if (countEl) {
        countEl.textContent = `${ratedCount} / ${total} TRACKS RATED`;
    }
    if (statusEl) {
        if (ratedCount === total && total > 0) {
            statusEl.textContent = "ALBUM RATED";
            statusEl.classList.add("is-complete");
        } else {
            statusEl.textContent = "YOUR ALBUM RATING";
            statusEl.classList.remove("is-complete");
        }
    }
    if (bar) {
        bar.classList.toggle("hidden", false);
    }

    lastStickyScoreText = scoreText;
}

function enhanceAlbumHeroActions() {
    // Inject save + open tracklist affordances into existing hero when present
    const hero = document.getElementById("albumHero");
    if (!hero || !currentAlbum) {
        return;
    }
    if (hero.querySelector(".album-extra-actions")) {
        refreshCollectButtons(currentAlbum.id);
        return;
    }
    const wrap = document.createElement("div");
    wrap.className = "album-extra-actions";
    wrap.innerHTML = `
        <button
            type="button"
            class="discovery-save"
            data-collect-album="${currentAlbum.id}"
            onclick="toggleCollectAlbum(${currentAlbum.id}, event)"
        >${isAlbumCollected(currentAlbum.id) ? "Saved" : "Save"}</button>
        <div class="album-tag-row">
            ${getAlbumGenreTags(currentAlbum).map(tag => `
                <button type="button" class="genre-chip" onclick="toggleSaveGenre('${tag.replace(/'/g, "\\'")}', event)">#${escapeHtml(tag)}</button>
            `).join("")}
        </div>
    `;
    hero.appendChild(wrap);
    refreshCollectButtons(currentAlbum.id);
}

/* ---------- friends page activity mode ---------- */

function enhanceFriendsPage() {
    const existing = document.getElementById("friendsActivity");
    if (existing) {
        renderFriendsActivityFeed();
        return;
    }
    const page = document.getElementById("friendsPage");
    if (!page) {
        return;
    }
    const mount = document.createElement("div");
    mount.id = "friendsActivity";
    mount.className = "friends-activity";
    page.insertBefore(mount, page.querySelector(".friends-search-wrap"));
    renderFriendsActivityFeed();
}

function renderFriendsActivityFeed() {
    const box = document.getElementById("friendsActivity");
    if (!box) {
        return;
    }
    if (!currentUser) {
        box.innerHTML = `<div class="empty-state">Log in to see friend activity.</div>`;
        return;
    }
    const rows = [];
    getFollowIds().forEach(userId => {
        const user = getUserById(userId);
        if (!user) {
            return;
        }
        getUserTopAlbums(userId, 5).forEach(entry => {
            rows.push({ user, album: entry.album, score: entry.score });
        });
    });
    if (!rows.length) {
        box.innerHTML = `<div class="empty-state">Follow people to build your activity feed.</div>`;
        return;
    }
    box.innerHTML = `
        <h2 class="friends-section-title">Activity</h2>
        ${rows.map(({ user, album, score }) => `
            <button type="button" class="activity-card" onclick="openAlbum(${album.id}, false, true)">
                <img src="${coverSrc(album.cover, 120)}" alt="" loading="lazy" width="56" height="56">
                <div class="activity-copy">
                    <span class="activity-user">${escapeHtml(user.username)}</span>
                    rated <strong>${escapeHtml(album.title)}</strong>
                    <span class="activity-score" style="${scoreColorStyle(score)}">${score.toFixed(1)}</span>
                </div>
            </button>
        `).join("")}
    `;
}

/* ---------- boot hooks ---------- */

function initRatedUI() {
    setupDiscoveryFeed();
    setHomeTab("albums");
    renderDiscoveryFeed(buildDiscoveryList());

    const progress = document.getElementById("albumProgressBar");
    if (progress) {
        progress.classList.remove("hidden");
    }

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            closePosterModal();
            closeProfileEdit();
        }
    });
}

document.addEventListener("DOMContentLoaded", () => {
    // Defer until albums + core script ready
    initRatedUI();
});
