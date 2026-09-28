"""Add underground and upcoming rappers who already have real projects.

Seeds are small-following artists with serious catalogs (NUMEKID and
similar). Related artists are added only when Deezer shows a small fan
count, so mainstream stars are not pulled in.

Hip-hop only. Reuses the existing Deezer filters in add_new_artists.
"""
import sys
import time

import add_new_artists as catalog
import import_all_hiphop as hiphop

# Explicit underground / upcoming names. Search must match the artist.
SEEDS = [
    "NUMEKID",
    "Nettspend",
    "Xaviersobased",
    "fakemink",
    "EsDeeKid",
    "Rich Amiri",
    "Lazer Dim 700",
    "nine vicious",
    "Dom Corleo",
    "Diorvsyou",
    "prettifun",
    "Autumn!",
    "Kankan",
    "Summrs",
    "Rome Streetz",
    "Stove God Cooks",
    "Mach-Hommy",
    "Tha God Fahim",
    "Fly Anakin",
    "Pink Siifu",
    "RxkNephew",
    "WiFiGawd",
    "Baby Smoove",
    "Rmc Mike",
    "Rio Da Yung Og",
    "Icewear Vezzo",
    "Babyface Ray",
    "Veeze",
    "BabyTron",
    "Lucki",
    "Duwap Kaine",
    "CHXPO",
    "Black Kray",
    "Lancey Foux",
    "Fimiguerrero",
    "redveil",
    "Billy Woods",
    "Boldy James",
    "ssgkobe",
    "KA$HDAMI",
    "Samara Cyn",
    "Babyxsosa",
    "midwxst",
    "Slump6s",
    "Homixide Gang",
    "Bktherula",
    "1900Rugrat",
    "Luh Tyler",
    "TisaKorean",
    "Valee",
    "ZelooperZ",
    "Bruiser Wolf",
    "Armand Hammer",
    "Medhane",
    "Maxo",
    "AllBlack",
    "Wiki",
    "Injury Reserve",
    "JPEGMAFIA",
    "Smino",
    "Knucks",
    "K-Trap",
    "Potter Payper",
    "Unknown T",
    "Clavish",
    "SoFaygo",
    "Chow Lee",
    "Nef the Pharaoh",
    "Your Old Droog",
    "Conway the Machine",
    "Westside Gunn",
    "Benny The Butcher",
    "Open Mike Eagle",
    "Quelle Chris",
    "Mick Jenkins",
    "Saba",
    "Elucid",
    "Ghais Guevara",
    "AKAI SOLO",
    "Niontay",
    "Sideshow",
    "lojii",
    "Edward Skeletrix",
    "Osamason",
    "2hollis",
]

# Related artists above this Deezer fan count are too established for this pass.
MAX_FANS = 60000
# Skip empty lookalike profiles. Named seeds are not held to this floor.
MIN_FANS = 40
MAX_NEW_ARTISTS = 110


def artist_snapshot(artist_id):
    data = catalog.get_json(f"https://api.deezer.com/artist/{artist_id}")
    return data.get("nb_fan") or 0, (data.get("name") or "").strip()


def load_state(albums):
    max_id = max(album["id"] for album in albums)
    existing_titles = {catalog.normalize(album["title"]) for album in albums}
    existing_cores = {catalog.core_title(album["title"]) for album in albums}
    existing_pairs = set()
    existing_artists = set()
    for album in albums:
        existing_artists.add(catalog.normalize(album["artist"]))
        for part in catalog.re.split(r"\s+&\s+", album["artist"]):
            existing_artists.add(catalog.normalize(part))
    return (max_id, existing_titles, existing_cores, existing_pairs, existing_artists)


def import_batch(names, albums, state):
    before = len(albums)
    max_id, _added, found = hiphop.import_names(names, albums, state)
    state = (
        max_id,
        state[1],
        state[2],
        state[3],
        state[4],
    )
    if len(albums) != before:
        hiphop.save_albums(albums)
    return state, found


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

    albums = catalog.load_albums()
    state = load_state(albums)
    existing_artists = state[4]
    print(f"catalog {len(albums)} albums, {len(existing_artists)} artist keys", flush=True)

    seeds = []
    for name in SEEDS:
        key = catalog.normalize(name)
        if key in existing_artists:
            print(f"already in {name}", flush=True)
            continue
        seeds.append(name)

    added_artists = []
    for start in range(0, len(seeds), 8):
        if len(added_artists) >= MAX_NEW_ARTISTS:
            break
        chunk = seeds[start:start + 8]
        print(f"seed batch {chunk[0]} …", flush=True)
        state, found = import_batch(chunk, albums, state)
        added_artists.extend(found)
        print(f"albums now {len(albums)} artists added {len(added_artists)}", flush=True)

    # Walk related artists of everyone we just added, staying under the fan cap.
    queue = []
    seen = set(existing_artists)
    for name in added_artists:
        try:
            artist_id, _canon = catalog.search_artist_id(name)
        except Exception:
            time.sleep(0.4)
            continue
        if not artist_id:
            continue
        try:
            related = hiphop.related_artists(artist_id)
        except Exception as error:
            print("related failed", name, error, flush=True)
            time.sleep(0.4)
            continue
        for row in related:
            rel_name = (row.get("name") or "").strip()
            key = catalog.normalize(rel_name)
            if not key or key in seen or key in hiphop.HARD_SKIP:
                continue
            fans = row.get("nb_fan")
            if fans is None and row.get("id"):
                try:
                    fans, rel_name = artist_snapshot(row["id"])
                except Exception:
                    fans = None
            if fans is None or fans < MIN_FANS or fans > MAX_FANS:
                continue
            seen.add(key)
            queue.append(rel_name)
        time.sleep(0.15)

    print(f"related underground candidates {len(queue)}", flush=True)
    room = MAX_NEW_ARTISTS - len(added_artists)
    for start in range(0, min(len(queue), room), 8):
        chunk = queue[start:start + 8]
        print(f"related batch {chunk[0]} …", flush=True)
        state, found = import_batch(chunk, albums, state)
        added_artists.extend(found)
        print(f"albums now {len(albums)} artists added {len(added_artists)}", flush=True)

    hiphop.save_albums(albums)
    print(f"done. new artists {len(added_artists)} total albums {len(albums)}", flush=True)
    for name in added_artists:
        print(f"  {name}", flush=True)


if __name__ == "__main__":
    main()
