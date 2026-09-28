"""Add missing albums, mixtapes, and EPs for artists already in js/albums.js.

Reuses Deezer search, genre checks, and track loading from add_new_artists.py.
Does not apply the old 12-album cap. Saves js/albums.js after every artist that
gains projects and resumes from data/backfill-albums-state.json.

Usage:
  python tools/backfill_existing_albums.py
  python tools/backfill_existing_albums.py --only Drake
"""
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from collections import Counter, defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import add_new_artists as catalog

BASE = Path(__file__).resolve().parent.parent
CHECKPOINT = BASE / "data" / "backfill-albums-state.json"
STATUS = BASE / "data" / "backfill-albums-status.txt"
LOG = BASE / "data" / "backfill-albums.log"
# Raw Deezer rows (singles included) before the album/EP filter.
MAX_RELEASE_ROWS = 800
SKIP_DIRECTORY = {"many more"}


def patient_get(url: str):
    """Deezer sometimes returns 429 or a quota error body. Sleep and retry."""
    last_error = None
    for attempt in range(10):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": catalog.UA})
            with urllib.request.urlopen(req, timeout=45) as resp:
                payload = json.loads(resp.read().decode("utf-8"))
            if isinstance(payload, dict) and payload.get("error"):
                message = json.dumps(payload.get("error"))
                code = (payload.get("error") or {}).get("code")
                if code in (4, 700) or "quota" in message.lower() or "limit" in message.lower():
                    raise urllib.error.HTTPError(url, 429, message, hdrs=None, fp=None)
                raise RuntimeError(message)
            return payload
        except urllib.error.HTTPError as error:
            last_error = error
            if error.code not in (429, 500, 502, 503, 504) or attempt == 9:
                raise
            wait = min(120, 8 * (attempt + 1))
            print(f"  http {error.code} sleep {wait}s", flush=True)
            time.sleep(wait)
        except Exception as error:
            last_error = error
            if attempt == 9:
                raise
            wait = min(90, 5 * (attempt + 1))
            print(f"  request sleep {wait}s ({error})", flush=True)
            time.sleep(wait)
    raise last_error


catalog.get_json = patient_get


def split_parts(artist: str):
    return [part.strip() for part in re.split(r"\s+&\s+", artist or "") if part.strip()]


def index_keys(artist: str):
    keys = {catalog.normalize(artist)}
    if re.search(r"\s+&\s+", artist or ""):
        for part in split_parts(artist):
            keys.add(catalog.normalize(part))
    return {key for key in keys if key}


def all_releases(artist_id: int):
    url = f"https://api.deezer.com/artist/{artist_id}/albums?limit=50"
    seen = []
    while url and len(seen) < MAX_RELEASE_ROWS:
        data = patient_get(url)
        batch = data.get("data") or []
        if not batch:
            break
        seen.extend(batch)
        url = (data.get("next") or "").replace("http://", "https://")
        time.sleep(0.12)
    return seen


def save_albums(albums):
    path = BASE / "js" / "albums.js"
    text = "const albums = " + json.dumps(albums, separators=(",", ":"), ensure_ascii=False) + ";\n"
    tmp = path.with_suffix(".js.tmp")
    last_error = None
    for attempt in range(8):
        try:
            tmp.write_text(text, encoding="utf-8", newline="\n")
            os.replace(tmp, path)
            return
        except OSError as error:
            last_error = error
            time.sleep(0.4 * (attempt + 1))
    raise last_error


def load_checkpoint():
    if CHECKPOINT.exists():
        state = json.loads(CHECKPOINT.read_text(encoding="utf-8"))
    else:
        state = {}
    state.setdefault("done", [])
    state.setdefault("gains", [])
    state.setdefault("skipped", [])
    state.setdefault("added_total", 0)
    return state


def write_checkpoint(state):
    CHECKPOINT.parent.mkdir(parents=True, exist_ok=True)
    CHECKPOINT.write_text(json.dumps(state, ensure_ascii=False), encoding="utf-8")


def write_status(line: str):
    STATUS.parent.mkdir(parents=True, exist_ok=True)
    STATUS.write_text(line + "\n", encoding="utf-8")


class Logger:
    def __init__(self, path: Path):
        path.parent.mkdir(parents=True, exist_ok=True)
        self.handle = path.open("a", encoding="utf-8")

    def log(self, message: str):
        print(message, flush=True)
        self.handle.write(message + "\n")
        self.handle.flush()


def directory_artists(albums):
    """Artists the app shows: credits split on ' & ', one row per normalized name."""
    full_norms = {catalog.normalize(album["artist"]) for album in albums}
    part_counts = defaultdict(Counter)
    credit_counts = Counter()
    for album in albums:
        credit_counts[album["artist"]] += 1
        for part in split_parts(album["artist"]):
            part_counts[catalog.normalize(part)][part] += 1
    credit_by_norm = {}
    for credit, _count in credit_counts.most_common():
        credit_by_norm.setdefault(catalog.normalize(credit), credit)
    artists = []
    for norm, counter in part_counts.items():
        if not norm or norm in SKIP_DIRECTORY:
            continue
        display = counter.most_common(1)[0][0]
        # "21 Savage, Offset" is a broken split of "21 Savage, Offset & Metro Boomin".
        # Real comma names such as "Tyler, The Creator" are full credits and stay.
        if "," in display and norm not in full_norms:
            continue
        artists.append((norm, display))
    artists.sort(key=lambda row: row[1].lower())
    return artists, credit_by_norm


def choose_storage(directory_name, release_artist, credit_by_norm):
    rel = (release_artist or "").strip() or directory_name
    rel_norm = catalog.normalize(rel)
    if rel_norm in credit_by_norm:
        return credit_by_norm[rel_norm]
    if rel_norm == catalog.normalize(directory_name):
        return directory_name
    if catalog.normalize(directory_name) in rel_norm or rel_norm in catalog.normalize(directory_name):
        return rel
    return directory_name


def already_have(pairs, artist, title):
    norm = catalog.normalize(title)
    core = catalog.core_title(title)
    for key in index_keys(artist):
        if (norm, key) in pairs or (core, key) in pairs:
            return True
    return False


def remember(pairs, artist, title):
    norm = catalog.normalize(title)
    core = catalog.core_title(title)
    for key in index_keys(artist):
        pairs.add((norm, key))
        pairs.add((core, key))


def song_signature(songs):
    return tuple(catalog.normalize(song) for song in songs if catalog.normalize(song))


def build_pairs(albums):
    pairs = set()
    signatures = set()
    for album in albums:
        remember(pairs, album["artist"], album["title"])
        signature = song_signature(album.get("songs") or [])
        if len(signature) >= catalog.MIN_TRACKS:
            signatures.add(signature)
    return pairs, signatures


def release_ok(release, display):
    title = (release.get("title") or "").strip()
    record_type = (release.get("record_type") or "").lower()
    tracks_n = release.get("nb_tracks")
    genre_id = release.get("genre_id")
    release_artist = ((release.get("artist") or {}).get("name") or "")
    if not title:
        return False
    if record_type not in {"album", "mixtape", "ep", ""}:
        return False
    if isinstance(tracks_n, int) and tracks_n > 0 and (
        tracks_n < catalog.MIN_TRACKS or tracks_n > catalog.MAX_TRACKS
    ):
        return False
    if genre_id in catalog.NON_GENRES:
        return False
    if genre_id not in catalog.HIPHOP_GENRE_IDS and genre_id not in (None, -1, 0):
        return False
    rel_norm = catalog.normalize(release_artist)
    name_norm = catalog.normalize(display)
    if rel_norm and name_norm not in rel_norm and rel_norm not in name_norm:
        return False
    if catalog.should_skip_title(title):
        return False
    date = release.get("release_date") or ""
    year = int(date[:4]) if date[:4].isdigit() else 0
    if year and year < catalog.MIN_YEAR:
        return False
    return True


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    only = []
    args = sys.argv[1:]
    if "--only" in args:
        only = [catalog.normalize(name) for name in args[args.index("--only") + 1 :]]
    logger = Logger(LOG)
    albums = catalog.load_albums()
    state = load_checkpoint()
    if "albums_before" not in state:
        state["albums_before"] = len(albums)
        state["max_id_before"] = max(album["id"] for album in albums)
        write_checkpoint(state)
    done = set(state["done"])
    artists, credit_by_norm = directory_artists(albums)
    if only:
        artists = [row for row in artists if row[0] in set(only)]
    pairs, signatures = build_pairs(albums)
    max_id = max(album["id"] for album in albums)
    logger.log(
        f"Backfill start. albums={len(albums)} artists={len(artists)} "
        f"done={len(done)} added_so_far={state['added_total']}"
    )
    for index, (norm, display) in enumerate(artists, start=1):
        if norm in done and not only:
            continue
        logger.log(f"[{index}/{len(artists)}] {display}")
        write_status(
            f"scanning {index}/{len(artists)} {display} | added={state['added_total']} albums={len(albums)}"
        )
        try:
            artist_id, canon = catalog.search_artist_id(display)
        except Exception as error:
            logger.log(f"  search failed: {error}")
            time.sleep(8)
            continue
        if not artist_id or catalog.normalize(canon or "") != norm:
            logger.log(f"  no exact Deezer artist (got {canon})")
            state["skipped"].append({"artist": display, "reason": f"no exact match ({canon})"})
            if not only:
                done.add(norm)
                state["done"] = sorted(done)
                write_checkpoint(state)
            continue
        time.sleep(0.12)
        try:
            releases = all_releases(artist_id)
        except Exception as error:
            logger.log(f"  albums failed: {error}")
            time.sleep(8)
            continue
        if not catalog.is_hiphop_artist(artist_id, releases):
            logger.log("  skip non-rap genres")
            state["skipped"].append({"artist": display, "reason": "non-rap"})
            if not only:
                done.add(norm)
                state["done"] = sorted(done)
                write_checkpoint(state)
            time.sleep(0.1)
            continue

        picked = []
        seen_cores = set()
        for release in releases:
            if not release_ok(release, display):
                continue
            title = (release.get("title") or "").strip()
            release_artist = ((release.get("artist") or {}).get("name") or "")
            storage = choose_storage(display, release_artist, credit_by_norm)
            if already_have(pairs, storage, title) or already_have(pairs, display, title):
                continue
            core = catalog.core_title(title)
            if core in seen_cores:
                continue
            seen_cores.add(core)
            picked.append((release, storage))
        # Prefer the plain title over a longer alternate that shares a core.
        picked.sort(
            key=lambda row: (
                0 if catalog.core_title(row[0].get("title") or "") == catalog.normalize(row[0].get("title") or "") else 1,
                len(row[0].get("title") or ""),
                row[0].get("release_date") or "",
            )
        )
        added_titles = []
        incomplete = False
        for release, storage in picked:
            title = (release.get("title") or "").strip()
            if already_have(pairs, storage, title):
                continue
            try:
                songs = catalog.album_tracks(release.get("id"))
            except Exception as error:
                logger.log(f"  tracks failed {title}: {error}")
                incomplete = True
                time.sleep(4)
                continue
            if len(songs) < catalog.MIN_TRACKS or len(songs) > catalog.MAX_TRACKS:
                continue
            signature = song_signature(songs)
            # Same tracklist already stored under another credit (collab listed twice).
            if signature in signatures:
                continue
            date = release.get("release_date") or ""
            year = int(date[:4]) if date[:4].isdigit() else 0
            cover = release.get("cover_xl") or release.get("cover_big") or release.get("cover") or ""
            max_id += 1
            albums.append(
                {
                    "id": max_id,
                    "title": title,
                    "artist": storage,
                    "year": year or 0,
                    "genre": "Hip-Hop",
                    "cover": cover,
                    "songs": songs,
                }
            )
            remember(pairs, storage, title)
            signatures.add(signature)
            added_titles.append(title)
            state["added_total"] += 1
            logger.log(f"  + {storage} — {title} ({year}, {len(songs)} tracks)")
            time.sleep(0.08)
        if added_titles:
            save_albums(albums)
            state["gains"].append(
                {"artist": display, "count": len(added_titles), "titles": added_titles[:8]}
            )
            logger.log(f"  saved {len(added_titles)} (catalog {len(albums)})")
        else:
            logger.log("  no new albums")
        if incomplete:
            logger.log("  unfinished track lists; will retry this artist")
            write_checkpoint(state)
            continue
        if not only:
            done.add(norm)
            state["done"] = sorted(done)
        write_checkpoint(state)
        write_status(
            f"scanned {index}/{len(artists)} {display} | added={state['added_total']} albums={len(albums)}"
        )
        time.sleep(0.08)
    logger.log(
        f"Backfill finished. before={state.get('albums_before')} after={len(albums)} "
        f"added={state['added_total']} scanned_done={len(done)}"
    )
    write_status(
        f"finished scanned={len(done)} added={state['added_total']} albums={len(albums)} before={state.get('albums_before')}"
    )


if __name__ == "__main__":
    main()
