"""Walk Deezer hip-hop sources and add missing rappers plus their albums.

Sources (in order):
  1) Deezer genre/116 artist chart (short, polluted — filtered)
  2) Tracks from genre/116 radios
  3) Related-artist BFS from catalog + seeds

Before accepting anyone from those lists, require Rap/Hip-Hop on their
Deezer albums (genre_id 116 or genre name containing rap / hip hop / hip-hop).
Resumes from data/hiphop-import-index.json. Pass --max-new to cap one run.
"""
import json
import sys
import time
from pathlib import Path

import add_new_artists as catalog

BASE = Path(__file__).resolve().parent.parent
CHECKPOINT = BASE / "data" / "hiphop-import-index.json"
GENRE = 116
# Skip obvious non-rap chart pollution even before album genre checks.
HARD_SKIP = {
    catalog.normalize(name)
    for name in (
        "Celine Dion",
        "Céline Dion",
        "Taylor Swift",
        "The Weeknd",
        "Michael Jackson",
        "Shakira",
        "Coldplay",
        "Angele",
        "Angèle",
        "Grand Corps Malade",
        "Lana Del Rey",
        "Aya Nakamura",
        "David Guetta",
        "Billie Eilish",
        "Olivia Rodrigo",
        "Ariana Grande",
        "Lady Gaga",
        "Bruno Mars",
        "Rihanna",
        "Linkin Park",
        "Beyonce",
        "Beyoncé",
        "Chris Brown",
        "HUGEL",
        "Stromae",
        "Britney Spears",
        "Johnny Cash",
        "Dolly Parton",
        "Willie Nelson",
        "Various Artists",
        "SZA",
        "Tems",
        "Kehlani",
        "Frank Ocean",
        "Brent Faiyaz",
        "Daniel Caesar",
        "H.E.R.",
        "Summer Walker",
        "Khalid",
        "Miguel",
        "Tinashe",
        "Ciara",
        "Steve Lacy",
    )
}


def load_checkpoint():
    if CHECKPOINT.exists():
        state = json.loads(CHECKPOINT.read_text(encoding="utf-8"))
    else:
        state = {}
    state.setdefault("index", 0)
    state.setdefault("genre_done", False)
    state.setdefault("radio_done", False)
    state.setdefault("done", False)
    state.setdefault("queue", [])
    state.setdefault("seen", [])
    state.setdefault("related_seeds_done", False)
    # Legacy: older runs set done=true after the non-paginating genre chart.
    if state.get("done") and not state.get("radio_done"):
        state["done"] = False
        state["genre_done"] = True
    return state


def save_checkpoint(state):
    CHECKPOINT.parent.mkdir(parents=True, exist_ok=True)
    CHECKPOINT.write_text(json.dumps(state, ensure_ascii=False), encoding="utf-8")


def page_genre_artists(index, limit=50):
    data = catalog.get_json(
        f"https://api.deezer.com/genre/{GENRE}/artists?index={index}&limit={limit}"
    )
    return data.get("data") or [], data.get("total"), data.get("next")


def collect_radio_artist_names():
    radios = catalog.get_json(f"https://api.deezer.com/genre/{GENRE}/radios")
    names = []
    seen = set()
    for radio in radios.get("data") or []:
        url = f"https://api.deezer.com/radio/{radio.get('id')}/tracks?limit=100"
        pages = 0
        while url and pages < 6:
            data = catalog.get_json(url)
            for track in data.get("data") or []:
                name = ((track.get("artist") or {}).get("name") or "").strip()
                key = catalog.normalize(name)
                if not name or key in seen:
                    continue
                seen.add(key)
                names.append(name)
            url = (data.get("next") or "").replace("http://", "https://")
            pages += 1
            time.sleep(0.15)
        time.sleep(0.2)
    return names


def related_artists(artist_id):
    data = catalog.get_json(
        f"https://api.deezer.com/artist/{artist_id}/related?limit=50"
    )
    out = []
    for row in data.get("data") or []:
        name = (row.get("name") or "").strip()
        if name:
            out.append({"id": row.get("id"), "name": name})
    return out


def import_names(names, albums, state_sets, enqueue_related=None):
    max_id, existing_titles, existing_cores, existing_pairs, existing_artists = state_sets
    added = 0
    found = []
    for name in names:
        key = catalog.normalize(name)
        if not key or key in HARD_SKIP:
            print(f"skip hard {name}", flush=True)
            continue
        if key in existing_artists:
            print(f"skip {name}", flush=True)
            continue
        print(f"check {name}", flush=True)
        try:
            artist_id, canon = catalog.search_artist_id(name)
        except Exception as error:
            print("  search failed", error, flush=True)
            time.sleep(1)
            continue
        if not artist_id:
            print("  no match", flush=True)
            continue
        display = canon or name
        display_key = catalog.normalize(display)
        if display_key in HARD_SKIP or display_key in existing_artists:
            print(f"  skip {display}", flush=True)
            continue
        time.sleep(0.2)
        try:
            releases = catalog.artist_albums(artist_id)
        except Exception as error:
            print("  albums failed", error, flush=True)
            continue
        if not catalog.is_hiphop_artist(artist_id, releases):
            print("  skip non-rap genres", flush=True)
            time.sleep(0.15)
            continue

        existing_artists.add(display_key)
        found.append(display)
        if enqueue_related is not None:
            enqueue_related(artist_id, display)

        picked = []
        for release in releases:
            title = (release.get("title") or "").strip()
            record_type = (release.get("record_type") or "").lower()
            tracks_n = release.get("nb_tracks") or 0
            genre_id = release.get("genre_id")
            if record_type not in {"album", "mixtape", ""}:
                continue
            if tracks_n and (tracks_n < 6 or tracks_n > 32):
                continue
            if genre_id in catalog.NON_GENRES:
                continue
            if catalog.should_skip_title(title):
                continue
            # Prefer hip-hop tagged albums; allow unknown (-1/0) after artist passed filter.
            if (
                genre_id not in catalog.HIPHOP_GENRE_IDS
                and genre_id not in (None, -1, 0)
            ):
                continue
            core = catalog.core_title(title)
            norm = catalog.normalize(title)
            if norm in existing_titles or core in existing_cores:
                continue
            date = release.get("release_date") or ""
            year = int(date[:4]) if date[:4].isdigit() else 0
            if year and year < 1988:
                continue
            picked.append(release)
        picked.sort(key=lambda row: row.get("release_date") or "", reverse=True)
        count = 0
        for release in picked[: catalog.MAX_ALBUMS_PER_ARTIST]:
            title = (release.get("title") or "").strip()
            try:
                songs = catalog.album_tracks(release.get("id"))
            except Exception as error:
                print("  tracks failed", title, error, flush=True)
                continue
            if len(songs) < 6 or len(songs) > 32:
                continue
            date = release.get("release_date") or ""
            year = int(date[:4]) if date[:4].isdigit() else 0
            cover = release.get("cover_xl") or release.get("cover_big") or release.get("cover") or ""
            max_id += 1
            albums.append({
                "id": max_id,
                "title": title,
                "artist": display,
                "year": year or 0,
                "genre": "Hip-Hop",
                "cover": cover,
                "songs": songs,
            })
            existing_titles.add(catalog.normalize(title))
            existing_cores.add(catalog.core_title(title))
            count += 1
            added += 1
            print(f"  + {title}", flush=True)
            time.sleep(0.1)
        if count == 0:
            print("  no albums", flush=True)
        time.sleep(0.2)
    return max_id, added, found


def save_albums(albums):
    path = BASE / "js" / "albums.js"
    text = "const albums = " + json.dumps(albums, separators=(",", ":")) + ";\n"
    last_error = None
    for attempt in range(8):
        try:
            path.write_text(text, encoding="utf-8")
            return
        except OSError as error:
            last_error = error
            time.sleep(0.4 * (attempt + 1))
    raise last_error


BOOTSTRAP_RELATED = [
    "Eminem",
    "Kendrick Lamar",
    "J. Cole",
    "Drake",
    "Nas",
    "2Pac",
    "The Notorious B.I.G.",
    "Jay-Z",
    "Kanye West",
    "Lil Wayne",
    "Ninho",
    "Booba",
    "Snoop Dogg",
    "Ice Cube",
    "Outkast",
    "Tyler, The Creator",
    "Travis Scott",
    "Future",
    "Megan Thee Stallion",
    "Nicki Minaj",
    "A$AP Rocky",
    "Playboi Carti",
    "MF DOOM",
    "Wu-Tang Clan",
    "Public Enemy",
    "Stormzy",
    "Skepta",
    "Central Cee",
    "Dave",
    "Gazo",
]


def seed_related_queue(checkpoint, existing_artists):
    """Fill BFS queue from radios + related artists of a small bootstrap set."""
    seen = set(checkpoint.get("seen") or [])
    queue = list(checkpoint.get("queue") or [])

    def push(name, artist_id=None):
        key = catalog.normalize(name)
        if not key or key in HARD_SKIP or key in seen:
            return
        seen.add(key)
        queue.append({"name": name, "id": artist_id})

    if not checkpoint.get("radio_done"):
        print("collecting genre radio artists…", flush=True)
        try:
            for name in collect_radio_artist_names():
                push(name)
        except Exception as error:
            print("radio collect failed", error, flush=True)
        checkpoint["radio_done"] = True
        print(f"radio seeds queued total {len(queue)}", flush=True)

    if not checkpoint.get("related_seeds_done"):
        print("bootstrapping related artists…", flush=True)
        for name in BOOTSTRAP_RELATED:
            try:
                artist_id, _canon = catalog.search_artist_id(name)
            except Exception:
                time.sleep(0.3)
                continue
            if not artist_id:
                continue
            try:
                for related in related_artists(artist_id):
                    push(related["name"], related.get("id"))
            except Exception as error:
                print("  related failed", name, error, flush=True)
            time.sleep(0.2)
        checkpoint["related_seeds_done"] = True
        print(f"related seeds done, queue {len(queue)}", flush=True)

    checkpoint["queue"] = queue
    checkpoint["seen"] = sorted(seen)
    save_checkpoint(checkpoint)
    return queue, seen

def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    max_new = 80
    extra = []
    args = sys.argv[1:]
    if "--max-new" in args:
        max_new = int(args[args.index("--max-new") + 1])
    if "--also" in args:
        extra = [part.strip() for part in args[args.index("--also") + 1].split("|") if part.strip()]

    albums = catalog.load_albums()
    max_id = max(album["id"] for album in albums)
    existing_titles = {catalog.normalize(album["title"]) for album in albums}
    existing_cores = {catalog.core_title(album["title"]) for album in albums}
    existing_pairs = set()
    existing_artists = set()
    for album in albums:
        existing_artists.add(catalog.normalize(album["artist"]))
        for part in catalog.re.split(r"\s+&\s+", album["artist"]):
            existing_artists.add(catalog.normalize(part))
    state = (max_id, existing_titles, existing_cores, existing_pairs, existing_artists)
    checkpoint = load_checkpoint()
    print(
        f"catalog {len(albums)} albums, genre_index {checkpoint['index']} "
        f"genre_done={checkpoint.get('genre_done')} radio_done={checkpoint.get('radio_done')} "
        f"queue={len(checkpoint.get('queue') or [])}",
        flush=True,
    )

    def enqueue_related(artist_id, display):
        seen = set(checkpoint.get("seen") or [])
        queue = list(checkpoint.get("queue") or [])
        try:
            related = related_artists(artist_id)
        except Exception:
            return
        for row in related:
            key = catalog.normalize(row["name"])
            if not key or key in HARD_SKIP or key in seen or key in existing_artists:
                continue
            seen.add(key)
            queue.append({"name": row["name"], "id": row.get("id")})
        checkpoint["seen"] = sorted(seen)
        checkpoint["queue"] = queue

    if extra:
        max_id, added, found = import_names(extra, albums, state, enqueue_related)
        state = (max_id, existing_titles, existing_cores, existing_pairs, existing_artists)
        save_albums(albums)
        save_checkpoint(checkpoint)
        print(f"named add {added} albums", flush=True)

    new_count = 0

    # Phase 1: finish genre chart pages (usually one short polluted page).
    index = checkpoint["index"]
    while (
        new_count < max_new
        and not checkpoint.get("genre_done")
        and not checkpoint.get("done")
    ):
        try:
            rows, total, nxt = page_genre_artists(index)
        except Exception as error:
            print("page failed", error, flush=True)
            time.sleep(3)
            break
        if not rows:
            checkpoint["genre_done"] = True
            break
        # Deezer often returns the same chart with no next — treat as one-shot.
        names = []
        for row in rows:
            name = row.get("name") or ""
            if catalog.normalize(name) not in existing_artists:
                names.append(name)
        print(f"genre page {index} total {total} candidates {len(names)}", flush=True)
        max_id, added, found = import_names(names, albums, state, enqueue_related)
        state = (max_id, existing_titles, existing_cores, existing_pairs, existing_artists)
        new_count += len(found)
        index += len(rows)
        checkpoint["index"] = index
        if not nxt or index >= 50:
            checkpoint["genre_done"] = True
        save_checkpoint(checkpoint)
        save_albums(albums)
        print(f"saved total albums {len(albums)} new artists this run {new_count}", flush=True)

    # Phase 2: radios + related BFS queue.
    if new_count < max_new and not checkpoint.get("done"):
        queue, seen = seed_related_queue(checkpoint, existing_artists)
        checkpoint = load_checkpoint()
        queue = list(checkpoint.get("queue") or [])
        seen = set(checkpoint.get("seen") or [])

        while new_count < max_new and queue:
            item = queue.pop(0)
            checkpoint["queue"] = queue
            name = item.get("name") or ""
            key = catalog.normalize(name)
            if not key or key in HARD_SKIP:
                continue
            # Already in catalog: still expand related graph, then skip import.
            if key in existing_artists:
                artist_id = item.get("id")
                if artist_id:
                    enqueue_related(artist_id, name)
                    queue = list(checkpoint.get("queue") or [])
                continue
            max_id, added, found = import_names([name], albums, state, enqueue_related)
            state = (max_id, existing_titles, existing_cores, existing_pairs, existing_artists)
            # Re-read queue — enqueue_related may have grown it.
            queue = list(checkpoint.get("queue") or [])
            new_count += len(found)
            if found or added:
                save_albums(albums)
                save_checkpoint(checkpoint)
                print(
                    f"saved total albums {len(albums)} new artists this run {new_count} queue {len(queue)}",
                    flush=True,
                )
            elif new_count % 5 == 0:
                save_checkpoint(checkpoint)

        if not queue:
            checkpoint["done"] = True
        save_checkpoint(checkpoint)
        save_albums(albums)

    print("finished run", flush=True)


if __name__ == "__main__":
    main()
