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
    return readSaveList("Artists").includes(String(name || ""));
}

function refreshSaveArtistButtons(name) {
    const artistName = String(name || "");
    const saved = isArtistSaved(artistName);
    document.querySelectorAll("[data-save-artist]").forEach(btn => {
        if (btn.getAttribute("data-save-artist") !== artistName) {
            return;
        }
        btn.classList.toggle("is-saved", saved);
        btn.setAttribute("aria-pressed", saved ? "true" : "false");
        if (btn.classList.contains("discovery-save")) {
            btn.textContent = saved ? "Saved" : "Save";
        } else if (btn.classList.contains("artist-save-chip")) {
            btn.textContent = `${artistName} · ${saved ? "Saved" : "Save"}`;
        }
    });
}

function toggleSaveArtist(name, event) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }
    if (!currentUser) {
        openAuth();
        return false;
    }
    const artistName = String(name || "");
    let list = readSaveList("Artists");
    if (list.includes(artistName)) {
        list = list.filter(x => x !== artistName);
    } else {
        list.push(artistName);
    }
    writeSaveList("Artists", list);
    refreshSaveArtistButtons(artistName);
    if (profileCollectionTab === "artists") {
        renderProfileCollections();
    }
    return list.includes(artistName);
}

function artistSaveOnclick(name) {
    return String(name || "")
        .replace(/\\/g, "\\\\")
        .replace(/'/g, "\\'");
}

function savedArtistPhotoSrc(name) {
    const photo =
        typeof artistPhotoSrc === "function"
            ? artistPhotoSrc(name)
            : null;
    if (photo) {
        return photo;
    }
    const artist =
        typeof getArtistDirectory === "function"
            ? getArtistDirectory().find(item => item.name === name)
            : null;
    if (artist && artist.albums && artist.albums[0]) {
        return coverSrc(artist.albums[0].cover);
    }
    return "";
}

function enhanceArtistHeroActions(artistName) {
    const hero = document.getElementById("artistHero");
    if (!hero || !artistName) {
        return;
    }
    const details = hero.querySelector(".album-details");
    if (!details) {
        return;
    }
    let wrap = details.querySelector(".artist-extra-actions");
    if (!wrap) {
        wrap = document.createElement("div");
        wrap.className = "artist-extra-actions album-extra-actions";
        details.appendChild(wrap);
    }
    const saved = isArtistSaved(artistName);
    wrap.innerHTML = `
        <button
            type="button"
            class="discovery-save ${saved ? "is-saved" : ""}"
            data-save-artist="${escapeHtml(artistName)}"
            aria-pressed="${saved ? "true" : "false"}"
            onclick="toggleSaveArtist('${artistSaveOnclick(artistName)}', event)"
        >${saved ? "Saved" : "Save"}</button>
    `;
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
    const fresh = document.getElementById("newReleasesPanel");

    if (discovery) {
        discovery.classList.toggle("hidden", tab !== "albums");
    }
    if (friendsFeed) {
        friendsFeed.classList.toggle("hidden", tab !== "friends");
    }
    if (best) {
        best.classList.toggle("hidden", tab !== "best");
    }
    if (fresh) {
        fresh.classList.toggle("hidden", tab !== "new");
    }

    if (tab === "albums") {
        renderDiscoveryFeed();
    } else if (tab === "friends") {
        renderHomeFriendsActivity();
    } else if (tab === "best") {
        renderBestAlbums();
    } else if (tab === "new") {
        renderNewReleases();
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

    const groups = new Map();
    albums.forEach(album => {
        const score = getAlbumGlobalRating(album.id);
        if (score === null) {
            return;
        }
        const tags = (typeof getAlbumGenreTags === "function" ? getAlbumGenreTags(album) : ["Hip-Hop"])
            .filter(tag => tag !== "Hip-Hop" && tag !== "Rap");
        const keys = tags.length ? tags : ["Hip-Hop"];
        keys.forEach(tag => {
            if (!groups.has(tag)) {
                groups.set(tag, []);
            }
            groups.get(tag).push({ album, score });
        });
    });

    const sections = [...groups.entries()]
        .map(([tag, list]) => ({
            tag,
            list: list.sort((a, b) => b.score - a.score).slice(0, 20)
        }))
        .filter(section => section.list.length)
        .sort((a, b) => b.list[0].score - a.list[0].score);

    if (!sections.length) {
        box.innerHTML = `<div class="empty-state">No community scores yet.</div>`;
        return;
    }

    box.innerHTML = sections.map(section => `
        <section class="new-section">
            <h2>${escapeHtml(section.tag)}</h2>
            <div class="new-row">
                ${section.list.map(({ album, score }) => `
                    <button type="button" class="new-card" onclick="openAlbum(${album.id})">
                        <img src="${coverSrc(album.cover, 250)}" alt="" loading="lazy" width="148" height="148">
                        <strong>${escapeHtml(album.title)}</strong>
                        <span>${escapeHtml(album.artist)}</span>
                        <em>${Number(score).toFixed(1)}</em>
                    </button>
                `).join("")}
            </div>
        </section>
    `).join("");
}

/* ---------- new releases ---------- */

function localDiscoveryPayload() {
    const currentYear = new Date().getFullYear();
    const recent = albums
        .filter(album => Number(album.year) >= currentYear - 1)
        .slice(0, 24)
        .map(album => ({
            localId: album.id,
            title: album.title,
            artist: album.artist,
            cover: album.cover,
            releaseDate: album.year ? String(album.year) : "",
            projectType: "album",
            trackCount: (album.songs || []).length,
            genres: [album.genre || "Hip-Hop"]
        }));
    const names = {};
    const newArtists = [];
    recent.forEach(card => {
        const key = card.artist.toLowerCase();
        if (names[key]) return;
        names[key] = true;
        const known = albums.filter(album => album.artist.toLowerCase() === key).length;
        newArtists.push({
            name: card.artist,
            image: "",
            genres: card.genres,
            latestProject: card.title,
            releaseDate: card.releaseDate,
            discoveryStatus: known <= 2 ? "new" : known <= 6 ? "emerging" : "established"
        });
    });
    return {
        source: "local",
        droppedToday: [],
        thisWeek: [],
        recent,
        newArtists: newArtists.slice(0, 16)
    };
}

function openDiscoveryCard(card) {
    if (card.localId) {
        openAlbum(card.localId);
        return;
    }
    const found = albums.find(album =>
        album.title.toLowerCase() === String(card.title || "").toLowerCase()
        && album.artist.toLowerCase() === String(card.artist || "").toLowerCase()
    );
    if (found) {
        openAlbum(found.id);
    }
}

function escapeNewText(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function discoveryCard(card, index) {
    const score = card.localId ? getAlbumGlobalRating(card.localId) : null;
    return `
        <button type="button" class="new-card" data-new-index="${index}">
            <img src="${card.cover || ""}" alt="">
            <strong>${escapeNewText(card.title)}</strong>
            <span>${escapeNewText(card.artist)}</span>
            <em>${escapeNewText(card.releaseDate)} · ${escapeNewText(card.projectType || "album")}${card.trackCount ? " · " + card.trackCount + " tracks" : ""}</em>
            ${score !== null && score !== undefined ? `<b>${score}</b>` : ""}
        </button>
    `;
}

function artistDiscoveryCard(artist) {
    const safe = String(artist.name || "").replace(/"/g, "&quot;");
    return `
        <button type="button" class="new-card new-artist-card" data-artist="${safe}">
            <span class="new-artist-mark">${(artist.name || "?").slice(0, 1)}</span>
            <strong>${escapeNewText(artist.name)}</strong>
            <span>${escapeNewText((artist.genres || []).join(" · "))}</span>
            <em>${escapeNewText(artist.latestProject)}</em>
            <b class="discovery-pill">${artist.discoveryStatus || "new"}</b>
        </button>
    `;
}

async function renderNewReleases() {
    const box = document.getElementById("newReleasesPanel");
    if (!box) return;
    box.innerHTML = `<div class="empty-state">Loading new releases…</div>`;
    let payload = null;
    try {
        const response = await fetch("api/discovery");
        if (response.ok) {
            payload = await response.json();
        }
    } catch {
        payload = null;
    }
    if (!payload || payload.source === "local" && !payload.recent) {
        payload = localDiscoveryPayload();
    } else if (payload.source === "local") {
        payload = localDiscoveryPayload();
    }
    const section = (title, items, renderer) => {
        if (!items || !items.length) return "";
        return `
            <section class="new-section">
                <h2>${title}</h2>
                <div class="new-row">${items.map((item, index) => renderer(item, index)).join("")}</div>
            </section>
        `;
    };
    window.__ratedNewCards = []
        .concat(payload.droppedToday || [])
        .concat(payload.thisWeek || [])
        .concat(payload.recent || []);
    const html = [
        section("Dropped today", payload.droppedToday, (card, index) => discoveryCard(card, index)),
        section("This week", payload.thisWeek, (card, index) => discoveryCard(card, (payload.droppedToday || []).length + index)),
        section("Recently dropped", payload.recent, (card, index) => discoveryCard(card, (payload.droppedToday || []).length + (payload.thisWeek || []).length + index)),
        section("New artists", payload.newArtists, artistDiscoveryCard)
    ].join("");
    box.innerHTML = html || `<div class="empty-state">No new Hip-Hop releases yet.</div>`;
    box.querySelectorAll("[data-new-index]").forEach(button => {
        button.addEventListener("click", () => {
            const card = window.__ratedNewCards[Number(button.dataset.newIndex)];
            if (card) openDiscoveryCard(card);
        });
    });
    box.querySelectorAll("[data-artist]").forEach(button => {
        button.addEventListener("click", () => openArtist(button.dataset.artist));
    });
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
            current.scrollIntoView({ block: "start", behavior: "instant" in window ? "instant" : "auto" });
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
                <div class="discovery-cover-slot">
                    <img
                        class="discovery-cover"
                        src="${coverSrc(album.cover, 500)}"
                        alt="${escapeHtml(album.title)}"
                        loading="${Math.abs(index - discoveryIndex) <= 1 ? "eager" : "lazy"}"
                        decoding="async"
                        width="500"
                        height="500"
                    >
                </div>
                <div class="discovery-meta">
                    <div class="discovery-title-row">
                        <div class="discovery-title-text">
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
                        </div>
                        <div class="discovery-title-scores" aria-label="Ratings">
                            <span class="discovery-score" title="Your rating">
                                <svg class="discovery-score-icon" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
                                    <circle cx="12" cy="8" r="3.6" fill="currentColor"/>
                                    <path d="M5.2 19.2c.7-3.4 3.3-5.2 6.8-5.2s6.1 1.8 6.8 5.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                                </svg>
                                <strong class="discovery-you" ${yours !== null ? `style="${scoreColorStyle(yours)}"` : ""}>
                                    ${yours !== null ? yours.toFixed(1) : "—"}
                                </strong>
                            </span>
                            <span class="discovery-score" title="Community rating">
                                <svg class="discovery-score-icon" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
                                    <circle cx="12" cy="12" r="8.2" fill="none" stroke="currentColor" stroke-width="1.8"/>
                                    <ellipse cx="12" cy="12" rx="3.2" ry="8.2" fill="none" stroke="currentColor" stroke-width="1.6"/>
                                    <path d="M4.2 12h15.6M5.4 7.6h13.2M5.4 16.4h13.2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                                </svg>
                                <strong class="discovery-community" ${community !== null ? `style="${scoreColorStyle(community)}"` : ""}>
                                    ${community !== null ? community.toFixed(1) : "—"}
                                </strong>
                            </span>
                        </div>
                    </div>
                    <div class="discovery-tags">
                        ${tags.map(tag => `
                            <button
                                type="button"
                                class="genre-chip ${isGenreSaved(tag) ? "is-saved" : ""}"
                                onclick="toggleSaveGenre('${tag.replace(/'/g, "\\'")}', event)"
                            >#${escapeHtml(tag)}</button>
                        `).join("")}
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
            }
        });
    }, { passive: true });

    const shiftWindow = () => {
        const localPos = discoveryIndex - discoveryWindowStart;
        if (localPos > 1 && localPos < DISCOVERY_WINDOW - 2) {
            return;
        }
        const keepId = discoveryList[discoveryIndex] && discoveryList[discoveryIndex].id;
        renderDiscoveryFeed();
        const again = feed.querySelector(`[data-album-id="${keepId}"]`);
        if (again) {
            again.scrollIntoView({ block: "start", behavior: "auto" });
        }
    };

    let settleTimer = null;
    feed.addEventListener("scroll", () => {
        clearTimeout(settleTimer);
        settleTimer = setTimeout(shiftWindow, 180);
    }, { passive: true });
    feed.addEventListener("scrollend", shiftWindow);

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

let profileEditMode = false;

function showProfile() {
    ensureLocalProfileIdentity();
    hideAllPages();
    setActiveNav("navProfile");
    const page = document.getElementById("profilePage");
    if (page) {
        page.classList.remove("hidden");
    }
    setProfileEditMode(false);
    renderProfilePage();
}

function setProfileEditMode(editing) {
    const wasEditing = profileEditMode;
    profileEditMode = Boolean(editing);
    const header = document.getElementById("profileHeader");
    const editBtn = document.getElementById("profileEditBtn");
    const avatarBtn = document.querySelector(".profile-avatar-btn");
    const display = document.getElementById("profileUsernameDisplay");
    const editRow = document.getElementById("profileUsernameEdit");
    const nameInput = document.getElementById("profileUsernameInput");

    if (header) {
        header.classList.toggle("is-editing", profileEditMode);
    }
    if (editBtn) {
        editBtn.setAttribute("aria-pressed", profileEditMode ? "true" : "false");
        editBtn.setAttribute("aria-label", profileEditMode ? "Done editing" : "Edit profile");
        editBtn.classList.toggle("active", profileEditMode);
    }
    if (avatarBtn) {
        avatarBtn.hidden = !profileEditMode;
    }
    if (display) {
        display.hidden = profileEditMode;
    }
    if (editRow) {
        editRow.hidden = !profileEditMode;
    }
    if (!profileEditMode) {
        setProfileHint("");
    } else if (nameInput) {
        nameInput.value = (currentUser && currentUser.username) || nameInput.value || "";
        if (!wasEditing) {
            requestAnimationFrame(() => {
                nameInput.focus();
                nameInput.select();
            });
        }
    }
}

function toggleProfileEditMode() {
    ensureLocalProfileIdentity();
    if (profileEditMode) {
        saveProfileUsername();
        return;
    }
    setProfileEditMode(true);
}

function getGuestProfileKey() {
    return "ratedGuestProfile";
}

function getGuestProfile() {
    try {
        return JSON.parse(localStorage.getItem(getGuestProfileKey()) || "null");
    } catch (error) {
        return null;
    }
}

function saveGuestProfile(profile) {
    localStorage.setItem(getGuestProfileKey(), JSON.stringify(profile));
}

function ensureLocalProfileIdentity() {
    if (currentUser) {
        return currentUser;
    }

    let guest = getGuestProfile();
    if (!guest || typeof guest !== "object") {
        guest = {
            id: "guest",
            username: "Guest",
            profile_picture: null,
            isGuest: true
        };
        saveGuestProfile(guest);
    }

    currentUser = {
        id: guest.id || "guest",
        username: guest.username || "Guest",
        email: guest.email || null,
        profile_picture: guest.profile_picture || null,
        isGuest: true
    };
    localStorage.setItem("ratedUser", JSON.stringify(currentUser));
    updateProfileButton();
    return currentUser;
}

function persistCurrentUserProfile() {
    if (!currentUser) {
        return;
    }

    localStorage.setItem("ratedUser", JSON.stringify(currentUser));

    if (currentUser.isGuest || currentUser.id === "guest") {
        saveGuestProfile({
            id: currentUser.id || "guest",
            username: currentUser.username,
            profile_picture: currentUser.profile_picture || null,
            isGuest: true
        });
        updateProfileButton();
        return;
    }

    const users = getLocalUsers();
    const index = users.findIndex(user => Number(user.id) === Number(currentUser.id));
    if (index >= 0) {
        users[index] = {
            ...users[index],
            username: currentUser.username,
            profile_picture: currentUser.profile_picture || null
        };
        localStorage.setItem("ratedLocalUsers", JSON.stringify(users));
    }

    updateProfileButton();
}

function setProfileHint(message, isError) {
    const hint = document.getElementById("profileUsernameHint");
    if (!hint) {
        return;
    }
    if (!message) {
        hint.hidden = true;
        hint.textContent = "";
        return;
    }
    hint.hidden = false;
    hint.textContent = message;
    hint.style.color = isError ? "#ff6b6b" : "#aaa";
}

function saveProfileUsername() {
    ensureLocalProfileIdentity();
    const input = document.getElementById("profileUsernameInput");
    if (!input || !currentUser) {
        return;
    }

    const username = input.value.trim().slice(0, 32);
    if (username.length < 2) {
        setProfileHint("Name needs at least 2 characters.", true);
        setProfileEditMode(true);
        return;
    }

    if (!currentUser.isGuest && currentUser.id !== "guest") {
        const taken = getLocalUsers().some(
            user =>
                Number(user.id) !== Number(currentUser.id) &&
                String(user.username || "").toLowerCase() === username.toLowerCase()
        );
        if (taken) {
            setProfileHint("That username is already taken.", true);
            setProfileEditMode(true);
            return;
        }
    }

    currentUser.username = username;
    persistCurrentUserProfile();
    setProfileEditMode(false);
    setProfileHint("Saved.", false);
    renderProfilePage();
}

async function onProfileAvatarSelected(event) {
    ensureLocalProfileIdentity();
    const input = event && event.target;
    const file = input && input.files && input.files[0];
    if (!file || !currentUser) {
        return;
    }

    try {
        const dataUrl = await fileToBase64(file);
        currentUser.profile_picture = dataUrl;
        persistCurrentUserProfile();
        setProfileHint("Photo updated.", false);
        renderProfilePage();
    } catch (error) {
        setProfileHint("Could not update photo.", true);
    } finally {
        if (input) {
            input.value = "";
        }
    }
}

function renderProfilePage() {
    ensureLocalProfileIdentity();
    if (!currentUser) {
        return;
    }

    const avatar = document.getElementById("profileAvatar");
    const nameInput = document.getElementById("profileUsernameInput");
    const nameDisplay = document.getElementById("profileUsernameDisplay");
    const friendsRow = document.getElementById("profileFriendsRow");
    const taste = document.getElementById("profileTasteTags");

    if (avatar) {
        if (currentUser.profile_picture) {
            avatar.innerHTML = `<img src="${currentUser.profile_picture}" alt="">`;
        } else {
            avatar.innerHTML = `<img src="assets/rated-icon-light.png?v=44" alt="RATED">`;
        }
    }
    if (nameDisplay) {
        nameDisplay.textContent = currentUser.username || "Guest";
    }
    if (nameInput && document.activeElement !== nameInput) {
        nameInput.value = currentUser.username || "";
    }
    setProfileEditMode(profileEditMode);

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
        const artistCounts = {};
        const genreCounts = {};
        const skipGenres = new Set(["Hip-Hop", "Rap"]);
        Object.keys(guestRatings || {}).forEach(albumId => {
            const album = albumById.get(Number(albumId));
            if (!album || getAlbumRating(Number(albumId)) === null) {
                return;
            }
            splitArtistNames(album.artist).forEach(artist => {
                artistCounts[artist] = (artistCounts[artist] || 0) + 1;
            });
            getAlbumGenreTags(album).forEach(tag => {
                if (skipGenres.has(tag)) {
                    return;
                }
                genreCounts[tag] = (genreCounts[tag] || 0) + 1;
            });
        });

        const ranked = [
            ...Object.entries(artistCounts).map(([name, count]) => ({ kind: "artist", name, count })),
            ...Object.entries(genreCounts).map(([name, count]) => ({ kind: "genre", name, count }))
        ].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

        const visible = ranked.slice(0, 5);
        const rest = ranked.slice(5);
        const savedArtists = new Set(readSaveList("Artists"));
        const savedGenres = new Set(readSaveList("Genres"));
        let artistsChanged = false;
        let genresChanged = false;
        rest.forEach(item => {
            if (item.kind === "artist") {
                if (!savedArtists.has(item.name)) {
                    savedArtists.add(item.name);
                    artistsChanged = true;
                }
            } else if (!savedGenres.has(item.name)) {
                savedGenres.add(item.name);
                genresChanged = true;
            }
        });
        if (artistsChanged) {
            writeSaveList("Artists", [...savedArtists]);
        }
        if (genresChanged) {
            writeSaveList("Genres", [...savedGenres]);
        }

        const chips = visible.map(item => {
            if (item.kind === "artist") {
                return `<button type="button" class="taste-chip artist ${isArtistSaved(item.name) ? "is-saved" : ""}" data-save-artist="${escapeHtml(item.name)}" aria-pressed="${isArtistSaved(item.name) ? "true" : "false"}" onclick="toggleSaveArtist('${artistSaveOnclick(item.name)}', event)">#${escapeHtml(item.name)}</button>`;
            }
            return `<button type="button" class="taste-chip genre" onclick="toggleSaveGenre('${item.name.replace(/'/g, "\\'")}', event)">#${escapeHtml(item.name)}</button>`;
        }).join("");

        taste.innerHTML = chips || `<span class="muted">Rate albums to build taste tags.</span>`;
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

function posterScoreRow(yours) {
    const text = yours !== null && yours !== undefined ? Number(yours).toFixed(1) : "—";
    return `
        <div class="poster-score-row">
            <strong>${text}</strong>
            <img class="poster-logo" src="assets/rated-mark-light.png?v=49" alt="RATED">
        </div>
    `;
}

function posterWash(album) {
    return `
        <div class="poster-wash" aria-hidden="true">
            <img src="${coverSrc(album.cover, 80)}" alt="">
        </div>
    `;
}

function createPosterCard(album, options = {}) {
    const yours = getAlbumRating(album.id);
    const large = Boolean(options.large);
    const front = `
        <div class="poster-face poster-front">
            ${posterWash(album)}
            <img
                class="poster-cover"
                src="${coverSrc(album.cover, large ? 500 : 250)}"
                alt="${escapeHtml(album.title)}"
                loading="lazy"
                decoding="async"
                width="250"
                height="250"
            >
            <div class="poster-copy">
                <h3 class="poster-title">${escapeHtml(album.title)}</h3>
                <p class="poster-artist">${escapeHtml(album.artist)}</p>
                ${posterScoreRow(yours)}
            </div>
        </div>
    `;

    if (!large) {
        return `
            <article class="poster-card" data-poster-album="${album.id}" onclick="openPosterModal(${album.id})">
                ${front}
            </article>
        `;
    }

    const tracks = album.songs.map((song, index) => {
        const songScore = getSongRating(album.id, index);
        const scoreText = songScore !== null && songScore !== undefined
            ? Number(songScore).toFixed(1)
            : "—";
        return `
            <li>
                <span class="poster-track-num">${index + 1}</span>
                <span class="poster-track-name">${escapeHtml(song)}</span>
                <span class="poster-track-score">${scoreText}</span>
            </li>
        `;
    }).join("");

    return `
        <article class="poster-card is-large" data-poster-album="${album.id}">
            <div class="poster-flip" onclick="flipPosterCard(this)">
                ${front}
                <div class="poster-face poster-back">
                    ${posterWash(album)}
                    <ol class="poster-tracks">${tracks}</ol>
                    ${posterScoreRow(yours)}
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
}

function openPosterModal(albumId) {
    const album = albumById.get(albumId);
    const modal = document.getElementById("posterModal");
    const body = document.getElementById("posterModalBody");
    if (!album || !modal || !body) {
        return;
    }
    body.innerHTML = createPosterCard(album, { large: true });
    modal.classList.remove("hidden");
}

function flipPosterCard(flip) {
    const card = flip && flip.closest ? flip.closest(".poster-card") : null;
    if (card) {
        card.classList.toggle("is-flipped");
    }
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
            ? `<div class="saved-artist-list">${list.map(name => {
                const src = savedArtistPhotoSrc(name);
                return `
                <button
                    type="button"
                    class="saved-artist-row"
                    onclick="openArtist('${encodeURIComponent(name)}')"
                >
                    ${src
                        ? `<img class="saved-artist-photo" src="${src}" alt="" loading="lazy" decoding="async" width="48" height="48">`
                        : `<span class="saved-artist-photo saved-artist-photo-fallback" aria-hidden="true"></span>`
                    }
                    <span class="saved-artist-name">${escapeHtml(name)}</span>
                </button>`;
            }).join("")}</div>`
            : `<div class="empty-state">Save artists from an album or artist page.</div>`;
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
    document.body.classList.toggle("search-is-open", searchOpen);
    if (searchOpen) {
        const input = document.getElementById("searchInput");
        if (input) {
            input.focus();
        }
    }
}

function searchRank(album, q) {
    const title = album.title.toLowerCase();
    const artist = album.artist.toLowerCase();
    if (title.startsWith(q)) return 0;
    if (artist.startsWith(q)) return 1;
    if (title.includes(q)) return 2;
    if (artist.includes(q)) return 3;
    const song = (album.songs || []).find(name => String(name).toLowerCase().includes(q));
    if (song) return 4;
    if (typeof albumMatchesGenreQuery === "function" && albumMatchesGenreQuery(album, q)) return 5;
    return 9;
}

function bindSearchResults() {
    const box = document.getElementById("searchResults");
    if (!box || box.dataset.bound) {
        return;
    }
    box.dataset.bound = "1";
    box.addEventListener("click", event => {
        const albumBtn = event.target.closest("[data-search-album]");
        if (albumBtn) {
            toggleSearch(false);
            openAlbum(Number(albumBtn.dataset.searchAlbum));
            return;
        }
        const artistBtn = event.target.closest("[data-search-artist]");
        if (artistBtn) {
            toggleSearch(false);
            openArtist(decodeURIComponent(artistBtn.dataset.searchArtist));
            return;
        }
        const genreBtn = event.target.closest("[data-search-genre]");
        if (genreBtn) {
            searchGenreTag(decodeURIComponent(genreBtn.dataset.searchGenre));
        }
    });
}

function renderExpandedSearch(query) {
    const box = document.getElementById("searchResults");
    if (!box) {
        return false;
    }
    bindSearchResults();

    const q = String(query || "").toLowerCase().trim();
    if (!q) {
        box.innerHTML = "";
        box.classList.add("hidden");
        return false;
    }

    const albumHits = albums
        .map(album => ({ album, rank: searchRank(album, q) }))
        .filter(entry => entry.rank < 9)
        .sort((a, b) => a.rank - b.rank || a.album.title.localeCompare(b.album.title))
        .slice(0, 24)
        .map(entry => entry);

    const artistHits = [];
    const seen = new Set();
    albums.forEach(album => {
        splitArtistNames(album.artist).forEach(name => {
            const key = name.toLowerCase();
            if (key.includes(q) && !seen.has(key)) {
                seen.add(key);
                artistHits.push(name);
            }
        });
    });
    artistHits.sort((a, b) => {
        const as = a.toLowerCase().startsWith(q) ? 0 : 1;
        const bs = b.toLowerCase().startsWith(q) ? 0 : 1;
        return as - bs || a.localeCompare(b);
    });

    const userHits = getPublicUsers().filter(user =>
        String(user.username || "").toLowerCase().includes(q)
    ).slice(0, 8);

    const genreHits = new Set();
    albums.forEach(album => {
        if (typeof getAlbumGenreTags !== "function") return;
        getAlbumGenreTags(album).forEach(tag => {
            if (tag.toLowerCase().includes(q)) {
                genreHits.add(tag);
            }
        });
    });

    const albumHtml = albumHits.map(({ album, rank }) => {
        const song = rank === 4
            ? (album.songs || []).find(name => String(name).toLowerCase().includes(q))
            : "";
        return `
            <button type="button" class="search-hit" data-search-album="${album.id}">
                <img src="${coverSrc(album.cover)}" alt="" width="56" height="56" loading="lazy" decoding="async">
                <span class="search-hit-copy">
                    <strong>${escapeHtml(album.title)}</strong>
                    <span>${escapeHtml(album.artist)}${album.year ? " · " + album.year : ""}${song ? " · " + escapeHtml(song) : ""}</span>
                </span>
            </button>
        `;
    }).join("");

    const sections = [];
    if (albumHits.length) {
        sections.push(`<section><h3>Albums</h3><div>${albumHtml}</div></section>`);
    }
    if (artistHits.length) {
        sections.push(`
            <section>
                <h3>Artists</h3>
                <div class="saved-chip-list">
                    ${artistHits.slice(0, 12).map(name => `
                        <button type="button" class="saved-chip" data-search-artist="${encodeURIComponent(name)}">${escapeHtml(name)}</button>
                    `).join("")}
                </div>
            </section>
        `);
    }
    if (userHits.length) {
        sections.push(`
            <section>
                <h3>Users</h3>
                <div class="friends-container">${userHits.map(user => createFriendRow(user)).join("")}</div>
            </section>
        `);
    }
    if (genreHits.size) {
        sections.push(`
            <section>
                <h3>Genres</h3>
                <div class="saved-chip-list">
                    ${[...genreHits].slice(0, 12).map(tag => `
                        <button type="button" class="saved-chip" data-search-genre="${encodeURIComponent(tag)}">${escapeHtml(tag)}</button>
                    `).join("")}
                </div>
            </section>
        `);
    }

    box.classList.remove("hidden");
    box.innerHTML = sections.join("") || `<p class="muted">No matches for “${escapeHtml(q)}”.</p>`;
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
        // Instant text while dragging so the album average tracks every tick.
        if (isDraggingSongLine || isDraggingDial) {
            scoreEl.classList.remove("score-pop");
            scoreEl.textContent = scoreText;
        } else {
            animateScoreNumber(scoreEl, scoreText);
        }
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
    const artistNames = splitArtistNames(currentAlbum.artist);
    wrap.innerHTML = `
        <button
            type="button"
            class="discovery-save"
            data-collect-album="${currentAlbum.id}"
            onclick="toggleCollectAlbum(${currentAlbum.id}, event)"
        >${isAlbumCollected(currentAlbum.id) ? "Saved" : "Save"}</button>
        <div class="album-tag-row album-artist-save-row">
            ${artistNames.map(name => `
                <button
                    type="button"
                    class="genre-chip artist-save-chip ${isArtistSaved(name) ? "is-saved" : ""}"
                    data-save-artist="${escapeHtml(name)}"
                    aria-pressed="${isArtistSaved(name) ? "true" : "false"}"
                    onclick="toggleSaveArtist('${artistSaveOnclick(name)}', event)"
                >${escapeHtml(name)} · ${isArtistSaved(name) ? "Saved" : "Save"}</button>
            `).join("")}
        </div>
        <div class="album-tag-row">
            ${getAlbumGenreTags(currentAlbum).map(tag => `
                <button type="button" class="genre-chip ${isGenreSaved(tag) ? "is-saved" : ""}" onclick="toggleSaveGenre('${tag.replace(/'/g, "\\'")}', event)">#${escapeHtml(tag)}</button>
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
        }
    });
}

document.addEventListener("DOMContentLoaded", () => {
    // Defer until albums + core script ready
    initRatedUI();
});
