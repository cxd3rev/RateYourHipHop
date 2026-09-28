import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
UA = "RateYourHipHop/1.0"
SKIP_TITLE = re.compile(
    r"greatest hits|the hits|playlist|karaoke|instrumental|acapella|"
    r"live at|live from|live in|come alive|"
    r"remix(es)?|anniversary|deluxe|collectors?|"
    r"extended version|expanded|remaster|soundtrack|inspired by|"
    r"compilation|best of|collection\b|mixtape volume|"
    r"bonus edition|alternate version|preluxe|chopped|"
    r"\bbeats\b|ringtones?|refill|curtain call|"
    r"edited version|explicit version|explicit booklet|"
    r"int'?l version|international version|"
    r"beginner's guide|back to the roots|spotify sessions|"
    r"re-?recorded|sped up|slowed|nightcore|tiktok|hi-five|"
    r"\bessential\b|\blive$|12[\"”]",
    re.I,
)
NON_GENRES = {85, 98, 106, 113, 129, 132, 169, 173, 466, 2}
HIPHOP_GENRE_IDS = {116}  # Deezer Rap/Hip Hop
# Full projects for artists added in a run. 1–2 track singles stay out.
MAX_ALBUMS_PER_ARTIST = 120
MIN_TRACKS = 3
MAX_TRACKS = 40
MIN_YEAR = 1979


def genre_name_is_hiphop(name: str) -> bool:
    text = (name or "").lower().replace("-", " ")
    return "rap" in text or "hip hop" in text


def releases_look_hiphop(releases) -> bool:
    """True if Deezer album rows are mostly tagged Rap/Hip-Hop."""
    hits = 0
    checked = 0
    for release in (releases or [])[:20]:
        gid = release.get("genre_id")
        if gid in NON_GENRES:
            continue
        if gid in (None, -1, 0):
            continue
        checked += 1
        if gid in HIPHOP_GENRE_IDS:
            hits += 1
    if hits >= 2:
        return True
    if hits >= 1 and checked <= 3:
        return True
    if checked > 0 and hits / checked >= 0.5:
        return True
    return False


def is_hiphop_artist(artist_id, releases=None) -> bool:
    """Require Rap/Hip-Hop on the artist's Deezer catalog before accepting."""
    rows = releases
    if rows is None:
        try:
            rows = artist_albums(artist_id)
        except Exception:
            return False
    if releases_look_hiphop(rows):
        return True
    if not rows:
        return False
    album_id = rows[0].get("id")
    if not album_id:
        return False
    try:
        detail = get_json(f"https://api.deezer.com/album/{album_id}")
    except Exception:
        return False
    if detail.get("genre_id") in HIPHOP_GENRE_IDS:
        return True
    for genre in ((detail.get("genres") or {}).get("data") or []):
        if genre_name_is_hiphop(genre.get("name") or ""):
            return True
    return False

# Hip-hop / rap names not already in the catalog (examples: Uzi, slayr, Osamason).
NEW_ARTISTS = [
    'Public Enemy',
    'N.W.A',
    'Eazy-E',
    'Eric B. & Rakim',
    'Gang Starr',
    'De La Soul',
    'Mos Def',
    'Talib Kweli',
    'The Pharcyde',
    'Bone Thugs-N-Harmony',
    'Twista',
    'Tech N9ne',
    'Too $hort',
    'E-40',
    'Scarface',
    'UGK',
    'Juvenile',
    "Cam'ron",
    'Jadakiss',
    'Redman',
    'Immortal Technique',
    'Sean Price',
    'Kodak Black',
    'French Montana',
    'Dave East',
    'AJ Tracey',
    'Giggs',
    'Loyle Carner',
    '$uicideboy$',
    'Sematary',
    'D. Savage',
    'UnoTheActivist',
    'SahBabii',
    'Glokk40Spaz',
    'Benji Blue Bills',
    'Young M.A',
    'Saweetie',
    'City Girls',
    'Fabolous',
    'Jim Jones',
    'Xzibit',
    'Kurupt',
    'Warren G',
    'Mystikal',
    'Geto Boys',
    'Digable Planets',
    'Black Moon',
    'Jeru the Damaja',
    'R.A. the Rugged Man',
    'Nav',
]


def get_json(url: str):
    last_error = None
    for attempt in range(6):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=30) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as error:
            last_error = error
            if error.code not in (429, 500, 502, 503, 504) or attempt == 5:
                raise
            time.sleep(1.2 * (attempt + 1))
        except Exception as error:
            last_error = error
            if attempt == 5:
                raise
            time.sleep(0.8 * (attempt + 1))
    raise last_error


def normalize(text: str) -> str:
    text = text.lower().replace("&", "and")
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def load_albums():
    raw = (BASE / "js" / "albums.js").read_text(encoding="utf-8")
    raw = raw.replace("const albums =", "", 1).strip()
    if raw.endswith(";"):
        raw = raw[:-1]
    return json.loads(raw)


def search_artist_id(name: str):
    q = urllib.parse.quote(name)
    data = get_json(f"https://api.deezer.com/search/artist?q={q}&limit=10")
    wanted = normalize(name)
    best = None
    best_score = -1
    exact = []
    for item in data.get("data") or []:
        got = normalize(item.get("name") or "")
        if got == wanted:
            exact.append(item)
            continue
        if wanted in got or got in wanted:
            score = 80
        else:
            wa, wb = set(wanted.split()), set(got.split())
            score = int(100 * len(wa & wb) / max(len(wa), 1))
        fans = item.get("nb_fan") or 0
        score = score + min(fans / 1_000_000, 15)
        if score > best_score:
            best_score = score
            best = item
    if exact:
        # Punctuation twins ("Kool G. Rap" vs "Kool G Rap") normalize the same.
        # Keep the profile listeners actually follow.
        chosen = max(exact, key=lambda item: item.get("nb_fan") or 0)
        return chosen.get("id"), chosen.get("name") or name
    if best and best_score >= 55:
        return best.get("id"), best.get("name") or name
    return None, None


def artist_albums(artist_id: int):
    url = f"https://api.deezer.com/artist/{artist_id}/albums?limit=50"
    seen = []
    while url:
        data = get_json(url)
        seen.extend(data.get("data") or [])
        url = (data.get("next") or "").replace("http://", "https://")
        time.sleep(0.15)
        if len(seen) > 400:
            break
    return seen


def album_tracks(album_id: int):
    songs = []
    url = f"https://api.deezer.com/album/{album_id}/tracks?limit=100"
    while url:
        data = get_json(url)
        for track in data.get("data") or []:
            title = (track.get("title") or "").strip()
            if title:
                songs.append(title)
        url = (data.get("next") or "").replace("http://", "https://")
        time.sleep(0.12)
    return songs


def core_title(title: str) -> str:
    text = re.sub(r"\([^)]*\)", " ", title or "")
    text = re.sub(r"\[[^\]]*\]", " ", text)
    return normalize(text)


def should_skip_title(title: str) -> bool:
    if SKIP_TITLE.search(title or ""):
        return True
    lowered = title.lower()
    if " edition" in lowered or " version" in lowered:
        return True
    return False


def search_photo(name: str) -> str:
    url = "https://api.deezer.com/search/artist?q=" + urllib.parse.quote(name) + "&limit=8"
    data = get_json(url)
    wanted = name.lower().replace(".", "").replace("$", "s")
    best = None
    for artist in data.get("data") or []:
        got = (artist.get("name") or "").lower().replace(".", "").replace("$", "s")
        picture = artist.get("picture_xl") or artist.get("picture_big") or artist.get("picture_medium")
        if not picture:
            continue
        if got == wanted:
            return picture
        if wanted in got or got in wanted:
            best = best or picture
    first = (data.get("data") or [None])[0]
    if first:
        return first.get("picture_xl") or first.get("picture_big") or first.get("picture_medium") or ""
    return best or ""


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

    albums = load_albums()
    max_id = max(album["id"] for album in albums)
    existing_titles = {normalize(album["title"]) for album in albums}
    existing_cores = {core_title(album["title"]) for album in albums}
    existing_pairs = {
        (normalize(album["title"]), normalize(album["artist"]))
        for album in albums
    }
    existing_artists = set()
    for album in albums:
        for part in re.split(r"\s+&\s+", album["artist"]):
            existing_artists.add(normalize(part))

    names = []
    seen = set()
    for name in NEW_ARTISTS:
        key = normalize(name)
        if key in existing_artists or key in seen:
            print(f"skip already in catalog: {name}", flush=True)
            continue
        seen.add(key)
        names.append(name)

    print(f"Adding up to {len(names)} new artists. Catalog starts at {len(albums)} albums.", flush=True)
    added = []
    found_artists = []

    for index, name in enumerate(names, start=1):
        print(f"[{index}/{len(names)}] {name}", flush=True)
        try:
            artist_id, canon = search_artist_id(name)
        except Exception as error:
            print("  search failed:", error, flush=True)
            time.sleep(0.4)
            continue
        if not artist_id:
            print("  no Deezer artist", flush=True)
            continue
        display = canon or name
        found_artists.append(display)
        time.sleep(0.2)
        try:
            releases = artist_albums(artist_id)
        except Exception as error:
            print("  albums failed:", error, flush=True)
            continue

        picked = []
        for release in releases:
            title = (release.get("title") or "").strip()
            record_type = (release.get("record_type") or "").lower()
            tracks_n = release.get("nb_tracks")
            genre_id = release.get("genre_id")
            release_artist = ((release.get("artist") or {}).get("name") or "")
            if record_type not in {"album", "mixtape", "ep", ""}:
                continue
            if isinstance(tracks_n, int) and tracks_n > 0 and (
                tracks_n < MIN_TRACKS or tracks_n > MAX_TRACKS
            ):
                continue
            if genre_id in NON_GENRES:
                continue
            rel_norm = normalize(release_artist)
            name_norm = normalize(display)
            if rel_norm and name_norm not in rel_norm and rel_norm not in name_norm:
                continue
            if should_skip_title(title):
                continue
            key = normalize(title)
            core = core_title(title)
            if key in existing_titles or core in existing_cores:
                continue
            if (key, name_norm) in existing_pairs:
                continue
            date = release.get("release_date") or ""
            year = int(date[:4]) if date[:4].isdigit() else 0
            if year and year < MIN_YEAR:
                continue
            picked.append(release)

        unique = []
        used = set()
        for release in picked:
            key = normalize(release.get("title") or "")
            core = core_title(release.get("title") or "")
            if key in used or key in existing_titles or core in existing_cores:
                continue
            used.add(key)
            unique.append(release)

        unique.sort(key=lambda r: r.get("release_date") or "", reverse=True)
        unique = unique[:MAX_ALBUMS_PER_ARTIST]

        artist_added = 0
        for release in unique:
            title = (release.get("title") or "").strip()
            album_id = release.get("id")
            date = release.get("release_date") or ""
            year = int(date[:4]) if date[:4].isdigit() else 0
            cover = (
                release.get("cover_xl")
                or release.get("cover_big")
                or release.get("cover")
                or ""
            )
            try:
                songs = album_tracks(album_id)
            except Exception as error:
                print("  tracks failed", title, error, flush=True)
                continue
            if len(songs) < MIN_TRACKS or len(songs) > MAX_TRACKS:
                continue
            max_id += 1
            entry = {
                "id": max_id,
                "title": title,
                "artist": display,
                "year": year or 0,
                "genre": "Hip-Hop",
                "cover": cover,
                "songs": songs,
            }
            albums.append(entry)
            added.append(f"{display} — {title} ({year})")
            existing_titles.add(normalize(title))
            existing_cores.add(core_title(title))
            existing_pairs.add((normalize(title), normalize(display)))
            artist_added += 1
            print(f"  + {title} ({year}, {len(songs)} tracks)", flush=True)
            time.sleep(0.12)

        if artist_added == 0:
            print("  no studio albums matched", flush=True)
        time.sleep(0.2)

    (BASE / "js" / "albums.js").write_text(
        "const albums = " + json.dumps(albums, separators=(",", ":")) + ";\n",
        encoding="utf-8",
    )
    print(f"\nAdded {len(added)} albums from {len(found_artists)} artists. Total now {len(albums)}.", flush=True)

    photos_path = BASE / "js" / "artistPhotos.js"
    raw_photos = photos_path.read_text(encoding="utf-8")
    raw_photos = raw_photos.replace("const artistPhotos =", "", 1).strip()
    if raw_photos.endswith(";"):
        raw_photos = raw_photos[:-1]
    photos = json.loads(raw_photos)
    for name in found_artists:
        if name in photos:
            continue
        try:
            pic = search_photo(name)
        except Exception:
            pic = ""
        if pic:
            photos[name] = pic
            print(f"  photo {name}", flush=True)
        time.sleep(0.12)
    photos_path.write_text(
        "const artistPhotos = " + json.dumps(photos, ensure_ascii=False, separators=(",", ":")) + ";\n",
        encoding="utf-8",
    )
    print("photos saved", len(photos), flush=True)


if __name__ == "__main__":
    main()
