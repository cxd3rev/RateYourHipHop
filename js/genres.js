/* =====================================================
   HIP-HOP / RAP GENRE TAGS
   Lightweight heuristics + map. No new database.
===================================================== */

const GENRE_TAG_MAP = {
    "kanye west": ["Rap", "Experimental"],
    "kendrick lamar": ["Conscious", "West Coast"],
    "drake": ["Rap", "R&B Rap"],
    "eminem": ["Rap", "Battle Rap"],
    "j cole": ["Conscious", "Rap"],
    "travis scott": ["Trap", "Psychedelic"],
    "tyler the creator": ["Alternative", "Experimental"],
    "tyler, the creator": ["Alternative", "Experimental"],
    "playboi carti": ["Rage", "Trap"],
    "lil uzi vert": ["Melodic", "Trap"],
    "future": ["Trap", "Atlanta"],
    "young thug": ["Trap", "Atlanta"],
    "metro boomin": ["Trap", "Production"],
    "the weeknd": ["R&B Rap", "Dark Pop-Rap"],
    "nas": ["East Coast", "Boom Bap"],
    "jay-z": ["East Coast", "Rap"],
    "jay z": ["East Coast", "Rap"],
    "wu-tang clan": ["East Coast", "Boom Bap"],
    "outkast": ["Southern", "Alternative"],
    "mf doom": ["Underground", "Abstract"],
    "madlib": ["Underground", "Abstract"],
    "freddie gibbs": ["Rap", "Gangsta"],
    "the alchemist": ["Underground", "Boom Bap"],
    "jid": ["Rap", "Lyricist"],
    "j.i.d": ["Rap", "Lyricist"],
    "little simz": ["UK Rap", "Conscious"],
    "skepta": ["UK Rap", "Grime"],
    "stormzy": ["UK Rap", "Grime"],
    "dave": ["UK Rap", "Conscious"],
    "central cee": ["UK Rap", "Drill"],
    "pop smoke": ["Drill", "Brooklyn"],
    "ice spice": ["Drill", "Bronx"],
    "nicki minaj": ["Rap", "Pop-Rap"],
    "cardi b": ["Rap", "Trap"],
    "megan thee stallion": ["Rap", "Southern"],
    "doja cat": ["Rap", "Alt-Rap"],
    "kid cudi": ["Alternative", "Melodic"],
    "asap rocky": ["Rap", "Fashion Rap"],
    "a$ap rocky": ["Rap", "Fashion Rap"],
    "brockhampton": ["Alternative", "Boy Band Rap"],
    "death grips": ["Experimental", "Industrial"],
    "jpegmafia": ["Experimental", "Abstract"],
    "earl sweatshirt": ["Underground", "Abstract"],
    "odd future": ["Alternative", "West Coast"],
    "mac miller": ["Rap", "Jazz Rap"],
    "anderson .paak": ["West Coast", "Funk Rap"],
    "anderson paak": ["West Coast", "Funk Rap"],
    "chance the rapper": ["Conscious", "Gospel Rap"],
    "logic": ["Rap", "Conscious"],
    "childish gambino": ["Alternative", "Experimental"],
    "danny brown": ["Experimental", "Underground"],
    "run the jewels": ["Rap", "Political"],
    "killer mike": ["Southern", "Political"],
    "el-p": ["Underground", "Experimental"],
    "2pac": ["West Coast", "Gangsta"],
    "tupac": ["West Coast", "Gangsta"],
    "the notorious b.i.g.": ["East Coast", "Gangsta"],
    "biggie": ["East Coast", "Gangsta"],
    "snoop dogg": ["West Coast", "G-Funk"],
    "dr. dre": ["West Coast", "G-Funk"],
    "n.w.a": ["West Coast", "Gangsta"],
    "ice cube": ["West Coast", "Gangsta"],
    "cypress hill": ["West Coast", "Latin Rap"],
    "mobb deep": ["East Coast", "Hardcore"],
    "gang starr": ["East Coast", "Boom Bap"],
    "a tribe called quest": ["East Coast", "Jazz Rap"],
    "de la soul": ["East Coast", "Jazz Rap"],
    "common": ["Conscious", "Chicago"],
    "lupe fiasco": ["Conscious", "Chicago"],
    "chief keef": ["Drill", "Chicago"],
    "lil baby": ["Trap", "Atlanta"],
    "gunna": ["Trap", "Atlanta"],
    "21 savage": ["Trap", "Atlanta"],
    "offset": ["Trap", "Atlanta"],
    "quavo": ["Trap", "Atlanta"],
    "migos": ["Trap", "Atlanta"],
    "gucci mane": ["Trap", "Atlanta"],
    "wiz khalifa": ["Rap", "Stoner Rap"],
    "wizone": ["Rap"],
    "big sei": ["Rap"],
    "big boi": ["Southern", "Atlanta"],
    "janelle monáe": ["Alt-Rap", "Afrofuturism"],
    "janelle monae": ["Alt-Rap", "Afrofuturism"],
    "black thought": ["East Coast", "Lyricist"],
    "the roots": ["East Coast", "Live Band"],
    "danger mouse": ["Alternative", "Production"],
    "pusha t": ["Rap", "Coke Rap"],
    "clipse": ["Rap", "Coke Rap"],
    "pharrell": ["Rap", "Production"],
    "n.e.r.d": ["Alternative", "Experimental"],
    "lil wayne": ["Southern", "Rap"],
    "nicki": ["Rap"],
    "xxxTentacion": ["Emo Rap", "SoundCloud"],
    "xxxtentacion": ["Emo Rap", "SoundCloud"],
    "juice wrld": ["Emo Rap", "Melodic"],
    "juice wrlD": ["Emo Rap", "Melodic"],
    "polo g": ["Melodic", "Drill"],
    "nba youngboy": ["Southern", "Melodic"],
    "youngboy never broke again": ["Southern", "Melodic"],
    "lil durk": ["Drill", "Chicago"],
    "rod wave": ["Melodic", "Southern"],
    "toosii": ["Melodic", "Rap"],
    "latto": ["Rap", "Southern"],
    "saweetie": ["Rap", "West Coast"],
    "flo milli": ["Rap", "Southern"],
    "rico nasty": ["Rage", "Alt-Rap"],
    "100 gecs": ["Experimental"],
    "100 gecs": ["Experimental"]
};

const TITLE_TAG_HEURISTICS = [
    { re: /\bdrill\b/i, tag: "Drill" },
    { re: /\btrap\b/i, tag: "Trap" },
    { re: /\bboom\s*bap\b/i, tag: "Boom Bap" },
    { re: /\bgangsta\b/i, tag: "Gangsta" },
    { re: /\bconscious\b/i, tag: "Conscious" },
    { re: /\bunderground\b/i, tag: "Underground" },
    { re: /\bwest\s*coast\b/i, tag: "West Coast" },
    { re: /\beast\s*coast\b/i, tag: "East Coast" },
    { re: /\bsouthern\b/i, tag: "Southern" },
    { re: /\buk\b/i, tag: "UK Rap" },
    { re: /\bgrime\b/i, tag: "Grime" },
    { re: /\brage\b/i, tag: "Rage" },
    { re: /\bemo\b/i, tag: "Emo Rap" },
    { re: /\bjazz\b/i, tag: "Jazz Rap" },
    { re: /\bexperimental\b/i, tag: "Experimental" },
    { re: /\balternative\b/i, tag: "Alternative" }
];

const genreTagCache = new Map();

function normalizeArtistKey(name) {
    return String(name || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s&,.$]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function getAlbumGenreTags(album) {
    if (!album) {
        return ["Hip-Hop", "Rap"];
    }

    const cacheKey = album.id;
    if (genreTagCache.has(cacheKey)) {
        return genreTagCache.get(cacheKey);
    }

    const tags = new Set(["Hip-Hop"]);

    const artists = String(album.artist || "")
        .split(/\s*(?:&|,|feat\.?|ft\.?|x)\s*/i)
        .map(normalizeArtistKey)
        .filter(Boolean);

    artists.forEach(key => {
        const mapped = GENRE_TAG_MAP[key];
        if (mapped) {
            mapped.forEach(tag => tags.add(tag));
        }
    });

    const haystack = `${album.title || ""} ${album.artist || ""}`;
    TITLE_TAG_HEURISTICS.forEach(({ re, tag }) => {
        if (re.test(haystack)) {
            tags.add(tag);
        }
    });

    if (!tags.has("Rap") && !tags.has("Trap") && !tags.has("Drill")) {
        tags.add("Rap");
    }

    const list = [...tags].slice(0, 5);
    genreTagCache.set(cacheKey, list);
    return list;
}

function albumMatchesGenreQuery(album, query) {
    const q = String(query || "").toLowerCase().trim();
    if (!q) {
        return true;
    }
    return getAlbumGenreTags(album).some(tag =>
        tag.toLowerCase().includes(q)
    );
}
