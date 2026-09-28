"""Add real hip-hop artists until the catalog has 1000 distinct names.

Counts the same way as the site audit: split artist credits on " & ".
Reuses Deezer search, hip-hop checks, and album import from the existing tools.
Saves js/albums.js after every artist that gains projects.
"""
import json
import sys
import time
from pathlib import Path

import add_new_artists as catalog
import import_all_hiphop as hiphop

BASE = Path(__file__).resolve().parent.parent
CHECKPOINT = BASE / "data" / "fill-1000-state.json"
STATUS = BASE / "data" / "fill-1000-status.txt"
TARGET = 1000

# Pop / R&B names that show up beside rappers on Deezer and should not be added.
EXTRA_SKIP = [
    "Post Malone", "The Kid LAROI", "The Kid Laroi", "Doja Cat", "Lizzo",
    "Justin Bieber", "Ed Sheeran", "Harry Styles", "Dua Lipa", "Adele",
    "Shawn Mendes", "Camila Cabello", "Selena Gomez", "Miley Cyrus",
    "Katy Perry", "Pharrell Williams", "Pharrell", "Usher", "Ne-Yo",
    "Alicia Keys", "John Legend", "PartyNextDoor", "PARTYNEXTDOOR",
    "Bryson Tiller", "6LACK", "Giveon", "Jhené Aiko", "Jhene Aiko",
    "Trey Songz", "Jacquees", "Ella Mai", "Jorja Smith", "Sabrina Claudio",
    "Aya Nakamura", "Dadju", "Tayc", "Vegedream", "Burna Boy", "Wizkid",
    "Davido", "Pitbull", "Flo Rida", "Black Eyed Peas", "will.i.am",
    "Machine Gun Kelly", "G-Eazy", "Lil Nas X", "Calvin Harris",
    "Marshmello", "The Chainsmokers", "Imagine Dragons", "Maroon 5",
    "Soolking", "Niska",  # Niska is rap — do not skip. removed below if present
    "GIMS", "Maître Gims", "Maitre Gims", "The Weeknd", "Chris Brown",
    "Rihanna", "Beyoncé", "Beyonce", "Ariana Grande", "Taylor Swift",
    "Billie Eilish", "Olivia Rodrigo", "Bruno Mars", "Lady Gaga",
    "Coldplay", "Linkin Park", "Shakira", "Celine Dion", "Céline Dion",
    "Michael Jackson", "David Guetta", "Dua Lipa", "Harry Styles",
    "Kehlani", "H.E.R.", "Summer Walker", "SZA", "Tinashe", "Ciara",
    "Khalid", "Miguel", "Steve Lacy", "Brent Faiyaz", "Daniel Caesar",
    "Frank Ocean", "Party Next Door", "PinkPantheress", "The Internet",
    "Syd", "SiR", "Bryson Tiller", "Giveon", "Jhené Aiko",
    "Various Artists", "Multi Interprètes", "Artistes Divers",
]

# Niska is a French rapper. Drop that mistaken skip if it landed in the list.
EXTRA_SKIP = [name for name in EXTRA_SKIP if catalog.normalize(name) != "niska"]

SEEDS = """
LL Cool J
Run-DMC
Beastie Boys
KRS-One
Boogie Down Productions
Big Daddy Kane
Slick Rick
Kool G Rap
Biz Markie
EPMD
Naughty By Nature
Salt-N-Pepa
Queen Latifah
MC Lyte
Jungle Brothers
Brand Nubian
Black Sheep
Leaders of the New School
Onyx
AZ
Cormega
Big Pun
Fat Joe
Ma$e
Diddy
Puff Daddy
Lil' Kim
Foxy Brown
Junior M.A.F.I.A.
The LOX
Styles P
Sheek Louch
Capone-N-Noreaga
M.O.P.
Smif-N-Wessun
Heltah Skeltah
O.G.C.
Boot Camp Clik
Das EFX
Nice & Smooth
Main Source
Pete Rock & CL Smooth
CL Smooth
Large Professor
Guru
DJ Premier
Group Home
Organized Konfusion
Pharoahe Monch
Dilated Peoples
Jurassic 5
Little Brother
Phonte
Rapper Big Pooh
9th Wonder
Slum Village
Souls of Mischief
Hieroglyphics
Del the Funky Homosapien
People Under The Stairs
Digital Underground
MC Ren
The D.O.C.
Above the Law
Compton's Most Wanted
DJ Quik
King Tee
WC
Mack 10
Westside Connection
Nate Dogg
Daz Dillinger
Tha Dogg Pound
The Lady of Rage
Do or Die
Crucial Conflict
Three 6 Mafia
Project Pat
Juicy J
DJ Paul
Gangsta Boo
Lord Infamous
8Ball & MJG
Goodie Mob
Jeezy
Young Jeezy
Ying Yang Twins
Crime Mob
D4L
Dem Franchize Boyz
Soulja Boy
Shawty Lo
Unk
Young Dro
OJ da Juiceman
Waka Flocka Flame
Pastor Troy
Lil Scrappy
Trillville
YoungBloodZ
Nappy Roots
Field Mob
Bubba Sparxxx
Yelawolf
Rittz
Krizz Kaliko
Brotha Lynch Hung
B-Legit
Mac Dre
Mac Mall
Keak da Sneak
Mistah F.A.B.
Andre Nickatina
Rappin' 4-Tay
Spice 1
MC Eiht
Kokane
The Jacka
Philthy Rich
Mozzy
San Quinn
RBL Posse
C-Bo
X-Raided
SPM
Lil' Flip
Chamillionaire
Paul Wall
Mike Jones
Slim Thug
Z-Ro
Trae tha Truth
Lil' Keke
ESG
Fat Pat
Big Hawk
Big Moe
Devin the Dude
Bun B
Pimp C
B.G.
Hot Boys
Turk
Birdman
Mannie Fresh
Big Tymers
Master P
Silkk the Shocker
C-Murder
Mia X
Soulja Slim
Boosie Badazz
Webbie
Foxx
Trick Daddy
Trina
Plies
Ace Hood
Gunplay
Wale
Lloyd Banks
Tony Yayo
Young Buck
Havoc
Prodigy
Big Noyd
Juelz Santana
The Diplomats
Hell Rell
Max B
Vado
Papoose
Uncle Murda
Maino
Eve
Drag-On
Cassidy
Beanie Sigel
Freeway
Peedi Crakk
State Property
Memphis Bleek
Sauce Money
Lord Finesse
O.C.
Showbiz & A.G.
Diamond D
N.O.R.E.
Capone
Tragedy Khadafi
Ice-T
GZA
RZA
Ol' Dirty Bastard
Inspectah Deck
U-God
Masta Killa
Cappadonna
Killah Priest
Killarmy
Sunz of Man
Gravediggaz
CZARFACE
7L & Esoteric
Esoteric
Keith Murray
Kool Keith
Ultramagnetic MC's
Tim Dog
Black Star
Reflection Eternal
Cannibal Ox
Company Flow
Atmosphere
Brother Ali
Evidence
Planet Asia
The Coup
Deltron 3030
Quasimoto
Jedi Mind Tricks
Vinnie Paz
Army of the Pharaohs
Apathy
Non Phixion
Ill Bill
Necro
Cage
Diabolic
CunninLynguists
Oddisee
Masta Ace
eMC
Wordsworth
Ed O.G.
KMD
3rd Bass
Whodini
Grandmaster Flash
Afrika Bambaataa
Kurtis Blow
Schoolly D
DJ Jazzy Jeff & The Fresh Prince
Casual
Pep Love
Paris
AMG
2nd II None
Cold 187um
Shyheim
La the Darkman
Hell Razah
Trife Da God
Meyhem Lauren
38 Spesh
Flee Lord
Smoke DZA
Trademark Da Skydiver
Young Roddy
Corner Boy P
Big Kahuna OG
Nickelus F
Chester Watson
Cavalier
YUNGMORPHEUS
EARTHGANG
Vic Mensa
Towkio
Joey Purp
Joseph Chilliams
CupcakKe
Da Brat
Lil Reese
Fredo Santana
King Louie
Lil Bibby
FBG Duck
Booka600
Memo600
Lil Zay Osama
Doodie Lo
LA Capone
Dreezy
Cupcakke
Jay Rock
REASON
Bas
Cozz
Omen
Lute
Dom Kennedy
Buddy
Casey Veggies
Iamsu!
Sage the Gemini
03 Greedo
Drakeo the Ruler
Remble
Shoreline Mafia
OhGeesy
SOB X RBE
Larry June
Kamaiyah
Takeoff
Rich the Kid
Famous Dex
Lil Pump
Smokepurpp
Pouya
Fat Nick
Ramirez
Night Lovell
Wifisfuneral
Craig Xen
Lil Tracy
Lil Peep
Xavier Wulf
Eddy Baker
Lil Ugly Mane
SpaceGhostPurrp
Robb Bank$
Yung Simmie
Nell
Cities Aviv
Sleepy Hallow
Sheff G
22Gz
Dusty Locane
Ron Suno
B-Lovee
Sha EK
Bobby Shmurda
Rowdy Rebel
Fetty Luciano
Don Q
Young Scooter
Peewee Longway
Blac Youngsta
BlocBoy JB
Big Scarr
Duke Deuce
Foogiano
Big30
NoCap
Rylo Rodriguez
Hotboii
Yungeen Ace
YNW Melly
Jackboy
Skilla Baby
Peezy
Payroll Giovanni
Doughboyz Cashout
BandGang Lonnie Bands
Kasher Quon
Drego
Beno
ShittyBoyz
FMB DZ
Sada Baby
Babyfxce E
Matt Ox
Lil Gnar
Yung Bans
$NOT
Night Lovell
BONES
Shakewell
Germ
Lil Skies
Iann Dior
Polo G
NLE Choppa
Pooh Shiesty
Big Homiie G
Gloss Up
Kenny Muney
Snupe Bandz
Paper Route Empire
Young Dolph
Key Glock
Moneybagg Yo
Yo Gotti
Gucci Mane
Lil Baby
Gunna
Future
Young Thug
21 Savage
Offset
Quavo
Migos
2 Chainz
Playboi Carti
Lil Yachty
Lil Uzi Vert
Destroy Lonely
Ken Carson
Yeat
SoFaygo
Summrs
Autumn!
Kankan
UnoTheActivist
Homixide Gang
Lancey Foux
Nettspend
OsamaSon
Xaviersobased
che
2hollis
fakemink
EsDeeKid
Rich Amiri
Lazer Dim 700
nine vicious
Dom Corleo
Diorvsyou
prettifun
NUMEKID
ssgkobe
KA$HDAMI
Babyxsosa
Samara Cyn
midwxst
Slump6s
1900Rugrat
Luh Tyler
CHXPO
Duwap Kaine
Lucki
Veeze
BabyTron
Icewear Vezzo
Babyface Ray
Rio Da Yung Og
Rmc Mike
Baby Smoove
RxkNephew
WiFiGawd
Black Kray
Fimiguerrero
redveil
billy woods
Boldy James
Rome Streetz
Stove God Cooks
Mach-Hommy
Tha God Fahim
Fly Anakin
Pink Siifu
JPEGMAFIA
Smino
Injury Reserve
Armand Hammer
Medhane
Maxo
AllBlack
Wiki
MIKE
Navy Blue
Earl Sweatshirt
Open Mike Eagle
Quelle Chris
Mick Jenkins
Saba
Elucid
Ghais Guevara
AKAI SOLO
Niontay
Sideshow
lojii
Your Old Droog
Conway the Machine
Westside Gunn
Benny the Butcher
Roc Marciano
Ka
al.divino
Estee Nack
Elcamino
Willie The Kid
Curren$y
Freddie Gibbs
Action Bronson
The Alchemist
Madlib
MF DOOM
Aesop Rock
Homeboy Sandman
Blockhead
Billy Woods
Quelle Chris
Denmark Vessey
Guilty Simpson
Black Milk
Apollo Brown
Phat Kat
Frank N Dank
Elzhi
J Dilla
Slum Village
Proof
Bizarre
D12
Obie Trice
Stat Quo
Joe Budden
Joell Ortiz
KXNG Crooked
Crooked I
Bad Meets Evil
Royce da 5'9"
Slaughterhouse
Ca$his
Trick Trick
King Gordy
Swizz Beatz
Ruff Ryders
Jin
The Game
Spider Loc
Jay Rock
Ab-Soul
ScHoolboy Q
Kendrick Lamar
Isaiah Rashad
Schoolboy Q
Nipsey Hussle
Dom Kennedy
Skeme
Overdoz
Casey Veggies
Iamsu
HBK
P-Lo
Kool John
OMB Peezy
Celly Ru
Philthy Rich
Messy Marv
Husalah
Ampichino
Guce
JT the Bigga Figga
Andre Nickatina
Mac Dre
The Luniz
Yukmouth
Numskull
Dru Down
Richie Rich
11/5
Seagram
Hi-C
King Tee
Tha Alkaholiks
Defari
Lootpack
Oh No
Wildchild
Ras Kass
Strong Arm Steady
Phil Da Agony
Krondon
Mitchy Slick
Blu
Exile
Fashawn
Co$$
Choosey
Reuben Vincent
Busdriver
Nocando
Dumbfoundead
Hodgy
Left Brain
Mike G
Brandun DeShay
Kilo Kish
Vince Staples
Mac Miller
Tyler, The Creator
Earl Sweatshirt
Domo Genesis
Frank Ocean
Odd Future
MellowHype
The Jet Age of Tomorrow
Casey Veggies
Sylvan LaCue
Hodgy Beats
Casey Veggies
Capital STEEZ
Nyck Caution
Kirk Knight
CJ Fly
Dessy Hinds
Chuck Strangers
Pro Era
Joey Bada$$
Flatbush Zombies
The Underachievers
Meechy Darko
Zombie Juice
Erick the Architect
Bodega Bamz
Remy Banks
World's Fair
A$AP Nast
A$AP Bari
A$AP Mob
Playboi Carti
A$AP Rocky
A$AP Ferg
A$AP Twelvyy
A$AP ANT
Issa Gold
AKTHESAVIOR
Pro Era
Beast Coast
World's Fair
Kirk Knight
Nyck @ Knight
CJ Fly
Dessy Hinds
Rokamouth
Dirty Sanchez
Powers Pleasant
Chuck Strangers
Capital STEEZ
Joey Badass
Flatbush Zombies
Erick Arc Elliott
Meechy Darko
Zombie Juice
The Underachievers
AK the Savior
Issa Gold
Bodega Bamz
Remy Banks
Tanboys
RetcH
Aston Matthews
Vince Staples
Larry Fisherman
Mac Miller
ScHoolboy Q
Jay Rock
Ab-Soul
Kendrick Lamar
Isaiah Rashad
REASON
Punch
Black Hippy
Top Dawg
SiR
Lance Skiiiwalker
Zacari
SZA
REASON
Jay Rock
Ab-Soul
Schoolboy Q
Kendrick Lamar
Isaiah Rashad
Nipsey Hussle
Dom Kennedy
Skeme
Buddy
Casey Veggies
Iamsu!
Sage The Gemini
P-Lo
Kool John
Dave Steezy
Jay Ant
Nef the Pharaoh
ALLBLACK
OMB Peezy
Zodiac
Kamaiyah
DaBoii
Yhung T.O.
Slimmy B
Lul G
Mozzy
Celly Ru
Philthy Rich
Zaytoven
03 Greedo
Drakeo the Ruler
Ralfy the Plug
Remble
Ketchy the Great
Sayso the Mac
Shoreline Mafia
OhGeesy
Fenix Flexin
Master Kato
Rob Vicious
SOB x RBE
Larry June
Cardo Got Wings
Vince Staples
Buddy
01. 2hollis
2hollis
Edward Skeletrix
OsamaSon
Nettspend
Xaviersobased
fakemink
EsDeeKid
Rich Amiri
Lazer Dim 700
nine vicious
Dom Corleo
Diorvsyou
prettifun
Autumn!
Kankan
Summrs
SoFaygo
UnoTheActivist
Homixide Gang
Destroy Lonely
Ken Carson
Yeat
Playboi Carti
Lil Uzi Vert
Lil Yachty
Trippie Redd
Juice WRLD
XXXTentacion
Ski Mask the Slump God
Denzel Curry
Pouya
Fat Nick
$uicideboy$
Ramirez
Germ
Shakewell
Night Lovell
BONES
Xavier Wulf
Eddy Baker
Chris Travis
Lil Ugly Mane
SpaceGhostPurrp
Robb Banks
Yung Simmie
Nell
Metro Zu
Lofty305
IndigoChildRick
Ethelwulf
Amber London
Cities Aviv
Antwon
Clipping
Death Grips
JPEGMAFIA
Danny Brown
Injury Reserve
BROCKHAMPTON
Kevin Abstract
Ameer Vann
Dom McLennon
Merlyn Wood
Matt Champion
JOBA
bearface
Romil Hemnani
Jabari Manwa
Kiko Merley
HK
Casey Veggies
Tyler The Creator
Earl Sweatshirt
Domo Genesis
Hodgy
Left Brain
Mike G
Jasper Dolphin
Taco
The Jet Age of Tomorrow
MellowHype
The Super 3
Brandun DeShay
Casey Veggies
Vince Staples
Mac Miller
Schoolboy Q
Jay Rock
Ab-Soul
Kendrick Lamar
Isaiah Rashad
Nipsey Hussle
Ghetts
Kano
Jme
Wiley
Dizzee Rascal
D Double E
Jammer
Frisco
P Money
Skepta
JME
Shorty
God's Gift
Not3s
Abra Cadabra
MIST
Fredo
Loski
Digga D
Dutchavelli
Tion Wayne
Russ Millions
ArrDee
Bugzy Malone
Ivorian Doll
Ms Banks
Stefflon Don
Lady Leshurr
Nadia Rose
ENNY
Bree Runway
Pa Salieu
BackRoad Gee
Suspect
Nines
Skrapz
Blade Brown
Ard Adz
D-Block Europe
Young Adz
Dirtbike LB
Smoke Boys
Sneakbo
Krept & Konan
Krept
Konan
Yungen
MoStack
Lotto Boyzz
Hardy Caprio
Swarmz
Poundz
M1llionz
Rimzee
V9
Kwengface
OFB
Bandokay
Double Lz
SJ
Lowkey
Akala
Jehst
Klashnekoff
Task Force
Chester P
Rodney P
Roots Manuva
Foreign Beggars
Skinnyman
Ocean Wisdom
Jam Baxter
Dirty Dike
Leaf Dog
The Four Owls
Verb T
Fliptrix
Mystro
Lee Scott
Black Josh
Dave
Stormzy
Central Cee
Headie One
AJ Tracey
Giggs
Unknown T
K-Trap
Potter Payper
Clavish
Knucks
Loyle Carner
Little Simz
Wretch 32
J Hus
Aitch
Headie One
Digga D
Unknown T
K-Trap
M1llionz
Potter Payper
Clavish
Knucks
Tion Wayne
Russ Millions
ArrDee
Bugzy Malone
Nines
Skrapz
D-Block Europe
Young Adz
Dirtbike LB
Fredo
Loski
Dutchavelli
Abra Cadabra
MIST
Pa Salieu
Sneakbo
Krept & Konan
Ghetts
Kano
Jme
Wiley
Dizzee Rascal
D Double E
Ocean Wisdom
Jehst
Roots Manuva
Foreign Beggars
Akala
Lowkey
Jul
SCH
Nekfeu
Damso
Freeze Corleone
Alpha Wann
Josman
Laylow
Hamza
PLK
Niska
Kaaris
Lacrim
Gradur
Rohff
Kery James
IAM
MC Solaar
Oxmo Puccino
Suprême NTM
JoeyStarr
Kool Shen
Fonky Family
Akhenaton
Shurik'n
Psy 4 de la Rime
Keny Arkana
Youssoupha
Disiz
Soprano
Alonzo
Maes
Koba LaD
SDM
Heuss L'enfoiré
Leto
Guy2Bezbar
Green Montana
Kerchak
Favé
Vald
Lorenzo
Dinos
Lesram
Prince Waly
Ichon
Nekfeu
Alpha Wann
Sneazzy
Deen Burbigo
Doums
Jazzy Bazz
Gros Mo
1995
Georgio
Winnterzuko
Bekar
Luv Resval
Kodes
Zola
Timal
Gambi
Naps
Gradur
Kalash Criminel
Sofiane
Mac Tyer
Alkpote
Niro
Guizmo
Dosseh
Jok'Air
Caballero & JeanJass
Roméo Elvis
Médine
Sniper
Tunisiano
Aketo
Blacko
Sefyu
La Fouine
Seth Gueko
Nessbeal
LIM
Alibi Montana
Despo Rutti
Sinik
Diam's
Ärsenik
Lunatic
Booba
Ninho
Gazo
PNL
Orelsan
Oboy
Ziak
Werenoi
Tiakola
Zamdane
La Fève
Djadja & Dinaz
Freeze Corleone
Osirus Jack
Alpha Wann
Josman
Laylow
Hamza
PLK
Niska
Kaaris
Lacrim
Maes
Koba LaD
SDM
Leto
Vald
Lorenzo
Nekfeu
SCH
Jul
Damso
Green Montana
Kerchak
Guy2Bezbar
Heuss L'Enfoiré
Zola
Kodes
Timal
Naps
Gambi
Kalash Criminel
Sofiane
Alkpote
Mac Tyer
Guizmo
Dosseh
Niro
Jok'Air
Caballero
JeanJass
Roméo Elvis
Georgio
Dinos
Lesram
Disiz
Youssoupha
Kery James
Médine
Rohff
Sniper
IAM
MC Solaar
Suprême NTM
JoeyStarr
Kool Shen
Oxmo Puccino
Akhenaton
Fonky Family
Psy4 de la Rime
Soprano
Alonzo
Keny Arkana
Passi
Stomy Bugsy
Doc Gyneco
La Fouine
Seth Gueko
Booba
Nessbeal
LIM
Sefyu
Diam's
Sinik
Youssoupha
Médine
Tunisiano
Aketo
Blacko
Sniper
Rohff
Kery James
Mafia K'1 Fry
Intouchable
Dry
Demon One
Karlito
Ideal J
Manu Key
AP du 113
113
Rim'K
Moha La Squale
MMZ
Hornet La Frappe
GLK
DA Uzi
Kofs
Ikaz Boi
Bosh
Josman
Laylow
Hamza
Alpha Wann
Nekfeu
Vald
Lorenzo
Dinos
Lesram
Limsa d'Aulnay
Prince Waly
Ichon
Winnterzuko
Bekar
Zola
Kodes
Luv Resval
Timal
Gambi
Naps
Gradur
Kalash Criminel
Sofiane
Alkpote
Freeze Corleone
SCH
Jul
PNL
Ninho
Gazo
Damso
PLK
Niska
Kaaris
Lacrim
Maes
Koba LaD
SDM
Leto
Green Montana
Kerchak
Guy2Bezbar
Heuss l'Enfoire
Oboy
Ziak
Werenoi
Tiakola
Zamdane
Tory Lanez
Pressa
Killy
88GLAM
Jazz Cartier
Smiley
Houdini
NorthSideBenji
Casper TNG
Lil Berete
AR Paisley
Kardinal Offishall
Maestro Fresh Wes
Shad
Classified
K'naan
Nav
Drake
PartyNextDoor
The Weeknd
Tory Lanez
Pressa
Killy
88Glam
Jazz Cartier
SAFE
Friyie
Why G
Pengz
Big Lean
Puffy L'z
Robin Banks
Trevor Spades
67
67
Section Boyz
67
Skengdo
AM
Skengdo & AM
67
Loski
MizOrMac
Headie One
Digga D
Unknown T
Central Cee
Dave
Stormzy
Skepta
AJ Tracey
Giggs
J Hus
Aitch
Headie One
OFB
Bandokay
Double Lz
SJ
Abra Cadabra
M1llionz
Potter Payper
Clavish
Knucks
Little Simz
Loyle Carner
Ghetts
Kano
Jme
Wiley
Dizzee Rascal
D Double E
Nines
Skrapz
D-Block Europe
Young Adz
Dirtbike LB
Tion Wayne
Russ Millions
ArrDee
Bugzy Malone
Pa Salieu
Fredo
Loski
Dutchavelli
Krept & Konan
Sneakbo
Yungen
MoStack
Hardy Caprio
Swarmz
Lowkey
Akala
Jehst
Ocean Wisdom
Roots Manuva
ONEFOUR
Hooligan Hefs
HP Boyz
Manu Crooks
Tkay Maidza
ONEFOUR
J Emz
Perrion
Celik
Lekks
ONEFOUR
The Kid LAROI
Hooligan Hefs
BLESSED
ChillinIt
ONEFOUR
Skepta
Jme
Wiley
Dizzee Rascal
Kano
Ghetts
Giggs
Dave
Stormzy
Central Cee
Headie One
Digga D
AJ Tracey
Unknown T
K-Trap
Little Simz
Loyle Carner
Knucks
Clavish
Potter Payper
Aitch
Bugzy Malone
Nines
Skrapz
D-Block Europe
Tion Wayne
Russ Millions
ArrDee
Pa Salieu
Abra Cadabra
MIST
Fredo
Loski
Dutchavelli
M1llionz
Rimzee
OFB
Bandokay
Double Lz
Lowkey
Akala
Jehst
Klashnekoff
Roots Manuva
Ocean Wisdom
Foreign Beggars
Skinnyman
Jam Baxter
Leaf Dog
The Four Owls
Verb T
Fliptrix
High Focus
Mystro
Lee Scott
Black Josh
Chester P
Task Force
Rodney P
D Double E
Jammer
P Money
Frisco
Shorty
God's Gift
Jammer
Wiley
Skepta
Jme
Boy Better Know
Roll Deep
Ruff Sqwad
Tinchy Stryder
Griminal
Fekky
Bonkaz
Cadell
Yungen
MoStack
Not3s
NSG
Kojo Funds
J Hus
Belly
Nav
Tory Lanez
Pressa
Killy
Jazz Cartier
Kardinal Offishall
Maestro Fresh Wes
Shad
Classified
Drake
Nav
PartyNextDoor
88GLAM
Lil Berete
NorthSideBenji
Houdini
Smiley
Casper TNG
SAFE
Big Lean
Robin Banks
Puffy L'z
Trevor Spades
Why G
Pengz
Friyie
AR Paisley
6ixbuzz
KILLY
88Glam
Jazz Cartier
Tory Lanez
Pressa
Nav
Drake
Belly
Mass Appeal
GZA
RZA
Ol Dirty Bastard
Inspectah Deck
U-God
Masta Killa
Cappadonna
Method Man
Ghostface Killah
Raekwon
Wu-Tang Clan
Killah Priest
Killarmy
Sunz of Man
Gravediggaz
CZARFACE
Esoteric
7L & Esoteric
Jedi Mind Tricks
Vinnie Paz
Ill Bill
Army of the Pharaohs
Apathy
Celph Titled
Reef the Lost Cauze
OuterSpace
Non Phixion
Sabac
Goretex
Necro
Cage
Copywrite
Jakki the Motamouth
Camu Tao
Aesop Rock
El-P
Company Flow
Cannibal Ox
Vast Aire
Vordul Mega
Atmosphere
Slug
Brother Ali
Eyedea
P.O.S
Doomtree
Grieves
CunninLynguists
Kno
Deacon the Villain
Natti
Little Brother
Phonte
Rapper Big Pooh
9th Wonder
The Away Team
Cesar Comanche
Skyzoo
Torae
Statik Selektah
Marco Polo
Oddisee
Diamond District
yU
Masta Ace
eMC
Stricklin
Wordsworth
Punchline & Wordsworth
Ed O.G. & Da Bulldogs
Ed O.G.
Pete Rock
CL Smooth
INI
Large Professor
Main Source
Gang Starr
Guru
DJ Premier
Group Home
Jeru the Damaja
Nice & Smooth
Brand Nubian
Grand Puba
Sadat X
Lord Jamar
Black Sheep
Dres
Leaders of the New School
Charlie Brown
Dinco D
Busta Rhymes
A Tribe Called Quest
Q-Tip
Phife Dawg
De La Soul
Jungle Brothers
Black Moon
Smif-N-Wessun
Heltah Skeltah
O.G.C.
Boot Camp Clik
Sean Price
Buckshot
Rock
Steele
Tek
Evil Dee
Cocoa Brovaz
Das EFX
Lords of the Underground
Onyx
M.O.P.
Naughty by Nature
Queen Latifah
MC Lyte
Salt-N-Pepa
Monie Love
Fu-Schnickens
Run-DMC
LL Cool J
Beastie Boys
Public Enemy
Boogie Down Productions
KRS-One
Scott La Rock
D-Nice
Big Daddy Kane
Biz Markie
Kool G Rap
Rakim
Eric B. & Rakim
Slick Rick
Doug E. Fresh
Special Ed
Audio Two
Stetsasonic
EPMD
Redman
Keith Murray
Erick Sermon
Parrish Smith
Whodini
Kurtis Blow
Grandmaster Flash & the Furious Five
Grandmaster Flash
Melle Mel
Afrika Bambaataa
Schoolly D
Ice-T
DJ Jazzy Jeff & The Fresh Prince
MC Hammer
Young MC
Tone Loc
Digital Underground
Shock G
Humpty Hump
2Pac
Raw Fusion
Saafir
The Pharcyde
Souls of Mischief
Del the Funky Homosapien
Hieroglyphics
Casual
Pep Love
Domino
The Coup
Paris
Too $hort
E-40
The Click
B-Legit
D-Shot
Suga-T
Spice 1
MC Eiht
Compton's Most Wanted
DJ Quik
King Tee
Tha Alkaholiks
Xzibit
Ras Kass
WC
Mack 10
Westside Connection
Ice Cube
Dr. Dre
Snoop Dogg
Nate Dogg
Warren G
Kurupt
Daz Dillinger
Tha Dogg Pound
The Lady of Rage
RBX
Bad Azz
Tray Deee
Goldie Loc
Tha Eastsidaz
Crooked I
Above the Law
Kokane
Cold 187um
N.W.A
Eazy-E
MC Ren
The D.O.C.
Bone Thugs-N-Harmony
Twista
Do or Die
Crucial Conflict
Geto Boys
Scarface
Willie D
Bushwick Bill
Devin the Dude
UGK
Bun B
Pimp C
8Ball & MJG
8Ball
MJG
Z-Ro
Trae tha Truth
Lil Keke
ESG
Fat Pat
Big Hawk
Big Moe
Chamillionaire
Paul Wall
Mike Jones
Slim Thug
Lil Flip
South Park Mexican
Lil Troy
Botany Boyz
5th Ward Boyz
Ganksta N-I-P
Facemob
Juvenile
B.G.
Hot Boys
Turk
Lil Wayne
Birdman
Mannie Fresh
Big Tymers
Mystikal
Master P
Silkk the Shocker
C-Murder
Mia X
Soulja Slim
Fiend
Magic
Mac
TRU
No Limit
Curren$y
Trademark Da Skydiver
Young Roddy
Lil Boosie
Webbie
Foxx
Trina
Trick Daddy
Rick Ross
Plies
Ace Hood
Gunplay
Wale
Meek Mill
French Montana
Fat Joe
Remy Ma
DJ Khaled
Big Pun
Terror Squad
Cuban Link
N.O.R.E.
Capone
Tragedy Khadafi
AZ
Cormega
Nature
Foxy Brown
Lil Kim
Nas
Mobb Deep
Havoc
Prodigy
Big Noyd
Infamous Mobb
Cam'ron
Juelz Santana
Jim Jones
The Diplomats
Hell Rell
JR Writer
40 Cal
Max B
French Montana
Dave East
Don Q
Vado
Papoose
Uncle Murda
Maino
Fabolous
Lloyd Banks
Tony Yayo
Young Buck
50 Cent
G-Unit
The Game
Obie Trice
D12
Proof
Bizarre
Stat Quo
Joe Budden
Joell Ortiz
KXNG Crooked
Styles P
Sheek Louch
The LOX
Jadakiss
Drag-On
Eve
DMX
Swizz Beatz
Cassidy
Beanie Sigel
Freeway
Peedi Crakk
Young Gunz
State Property
Memphis Bleek
Jay-Z
Nas
AZ
Cormega
Lil' Kim
Foxy Brown
Ma$e
Diddy
Black Rob
G. Dep
Shyne
Loon
Young Jeezy
Yo Gotti
Blac Youngsta
BlocBoy JB
Moneybagg Yo
Young Dolph
Key Glock
Big Scarr
Gucci Mane
Waka Flocka Flame
OJ da Juiceman
Roscoe Dash
Travis Porter
Soulja Boy
Shawty Lo
D4L
Crime Mob
Unk
Dem Franchize Boyz
Lil Scrappy
Trillville
Pastor Troy
Ying Yang Twins
Petey Pablo
Bubba Sparxxx
Field Mob
YoungBloodZ
Nappy Roots
David Banner
Lil Flip
Chamillionaire
Paul Wall
Mike Jones
Slim Thug
Z-Ro
Trae tha Truth
Bun B
Pimp C
Devin the Dude
Scarface
Geto Boys
Juvenile
B.G.
Turk
Birdman
Mannie Fresh
Big Tymers
Master P
Silkk the Shocker
C-Murder
Mia X
Soulja Slim
Boosie Badazz
Webbie
Foxx
Trina
Trick Daddy
Rick Ross
Plies
Ace Hood
Gunplay
Wale
Meek Mill
French Montana
Fat Joe
Remy Ma
Lloyd Banks
Tony Yayo
Young Buck
Papoose
Maino
Uncle Murda
Styles P
Sheek Louch
Joe Budden
Joell Ortiz
KXNG Crooked
Juelz Santana
Hell Rell
Max B
Don Q
Vado
AZ
Cormega
Lil Kim
Foxy Brown
Mase
Diddy
Black Rob
G. Dep
Shyne
Jeezy
T.I.
Ludacris
Outkast
Goodie Mob
Andre 3000
Big Boi
Killer Mike
CeeLo Green
Sleepy Brown
Gucci Mane
Young Dro
DJ Drama
OJ da Juiceman
Waka Flocka Flame
2 Chainz
Playboi Carti
Future
Young Thug
Lil Baby
Gunna
21 Savage
Metro Boomin
Offset
Quavo
Takeoff
Migos
Rich the Kid
Famous Dex
Lil Pump
Smokepurpp
Ski Mask the Slump God
Denzel Curry
XXXTentacion
Juice WRLD
Trippie Redd
Lil Tecca
Polo G
Lil Tjay
NLE Choppa
Pooh Shiesty
Kodak Black
YNW Melly
Hotboii
Yungeen Ace
Jackboy
NoCap
Rylo Rodriguez
EST Gee
42 Dugg
Skilla Baby
Babyface Ray
Veeze
Rio Da Yung OG
RMC Mike
Icewear Vezzo
BabyTron
Peezy
Doughboyz Cashout
Payroll Giovanni
BandGang
Drego & Beno
Kasher Quon
Baby Smoove
ShittyBoyz
FMB DZ
Sada Baby
Lil Durk
King Von
G Herbo
Chief Keef
Lil Reese
Fredo Santana
King Louie
Lil Bibby
FBG Duck
Polo G
Lil Tjay
Fivio Foreign
Pop Smoke
Kay Flock
Sleepy Hallow
Sheff G
22Gz
Dusty Locane
Ron Suno
B-Lovee
Sha EK
Bobby Shmurda
Rowdy Rebel
A Boogie Wit da Hoodie
Don Q
Fabolous
Dave East
French Montana
Jim Jones
Cam'ron
Juelz Santana
Max B
The Lox
Jadakiss
Styles P
Sheek Louch
Fat Joe
Big Pun
Remy Ma
N.O.R.E.
AZ
Cormega
Lil' Kim
Foxy Brown
Jay Electronica
Nas
Mobb Deep
Wu-Tang Clan
GZA
RZA
Ol' Dirty Bastard
Inspectah Deck
Raekwon
Ghostface Killah
Method Man
Redman
EPMD
Gang Starr
Nas
AZ
Big L
Lord Finesse
O.C.
Showbiz & A.G.
Diamond D
Pete Rock
CL Smooth
KRS-One
Big Daddy Kane
Slick Rick
Rakim
LL Cool J
Run-DMC
Beastie Boys
Public Enemy
Ice Cube
Dr. Dre
Snoop Dogg
2Pac
The Notorious B.I.G.
Jay-Z
Eminem
Nas
Kendrick Lamar
J. Cole
Drake
Tyler, the Creator
Travis Scott
Future
Young Thug
Lil Wayne
Nicki Minaj
Megan Thee Stallion
Cardi B
Doja Cat
Latto
GloRilla
Sexyy Red
Ice Spice
Doechii
Flo Milli
Saweetie
Coi Leray
BIA
Rico Nasty
Young M.A
City Girls
Lola Brooke
Armani Caesar
Asian Doll
Sukihana
Rubi Rose
Leikeli47
Junglepussy
CupcakKe
Kamaiyah
Noname
Smino
Saba
Mick Jenkins
Little Simz
Rapsody
Sa-Roc
Jean Grae
Che Noir
Rapsody
Chika
Flo Milli
Doechii
GloRilla
Sexyy Red
Latto
Cardi B
Megan Thee Stallion
Nicki Minaj
Ice Spice
Lola Brooke
Armani Caesar
Leikeli47
Junglepussy
CupcakKe
Kamaiyah
Rico Nasty
BbyMutha
Erica Banks
Maiya The Don
ScarLip
Baby Tate
Lola Brooke
Connie Diiamond
Lady London
Maliibu Miitch
Chika
Sa-Roc
Jean Grae
Che Noir
Rapsody
Little Simz
Doechii
Flo Milli
GloRilla
Sexyy Red
Latto
Ice Spice
Young M.A
City Girls
JT
Yung Miami
Asian Doll
Sukihana
Rubi Rose
BIA
Coi Leray
Saweetie
Rico Nasty
Megan Thee Stallion
Cardi B
Nicki Minaj
Do or Die
Crucial Conflict
Twista
Da Brat
Common
Lupe Fiasco
Kanye West
Chance the Rapper
Vic Mensa
Noname
Saba
Mick Jenkins
Smino
Valee
G Herbo
Lil Bibby
King Louie
Chief Keef
Lil Durk
King Von
Polo G
Lil Tjay
Juice WRLD
CupcakKe
Pivot Gang
Joseph Chilliams
Femdot
Jean Deaux
Lucki
Chief Keef
Fred Santana
Lil Reese
SD
Ballout
Tadoe
RondoNumbaNine
FBG Duck
LA Capone
Dreezy
Katie Got Bandz
Sasha Go Hard
Booka600
Memo600
Lil Zay Osama
Doodie Lo
PGF Nuk
Only the Family
Hypno Carlito
600 Breezy
Edai
Lil Mouse
King Louie
Lil Herb
G Herbo
Lil Bibby
Sicko Mobb
Famous Dex
Supa Bwe
Warhol.SS
CupcakKe
Twista
Do or Die
Crucial Conflict
Da Brat
Common
Kanye West
Lupe Fiasco
Chance the Rapper
Vic Mensa
Towkio
Joey Purp
Mick Jenkins
Noname
Saba
Smino
Valee
Pivot Gang
Joseph Chilliams
Leather Corduroys
Kami
SaveMoney
Joey Purp
Towkio
Vic Mensa
Chance the Rapper
Saba
Noname
Mick Jenkins
Smino
Jean Deaux
Femdot
Matt Muse
Pivot Gang
Joseph Chilliams
daedaePIVOT
MFnMelo
SqueakPIVOT
Lucki
Chief Keef
G Herbo
Lil Durk
King Von
Lil Reese
Fredo Santana
King Louie
Lil Bibby
SD
FBG Duck
Booka600
Memo600
Lil Zay Osama
Doodie Lo
Dreezy
CupcakKe
Valee
Twista
Polo G
Lil Tjay
Fivio Foreign
Pop Smoke
Kay Flock
Sleepy Hallow
Sheff G
22Gz
Dusty Locane
Ron Suno
B-Lovee
Sha EK
Dougie B
Bobby Shmurda
Rowdy Rebel
Fetty Luciano
Maino
Uncle Murda
Fabolous
Lloyd Banks
Tony Yayo
Young Buck
50 Cent
The Game
Papoose
Remy Ma
Fat Joe
Joe Budden
Styles P
Sheek Louch
Jadakiss
The LOX
DMX
Eve
Drag-On
Swizz Beatz
Cassidy
Beanie Sigel
Freeway
Peedi Crakk
State Property
Memphis Bleek
Juelz Santana
Hell Rell
JR Writer
40 Cal
Max B
The Diplomats
Cam'ron
Jim Jones
Vado
Don Q
Dave East
French Montana
A Boogie Wit da Hoodie
Bobby Shmurda
Rowdy Rebel
Pop Smoke
Fivio Foreign
Kay Flock
Sleepy Hallow
Sheff G
22Gz
Dusty Locane
B-Lovee
Sha EK
Ron Suno
Maino
Uncle Murda
Papoose
Remy Ma
Fat Joe
Big Pun
N.O.R.E.
Capone
AZ
Cormega
Nature
Foxy Brown
Lil' Kim
Ma$e
Diddy
Black Rob
G. Dep
Shyne
Jay-Z
Nas
Mobb Deep
Wu-Tang Clan
GZA
RZA
Ghostface Killah
Raekwon
Method Man
Inspectah Deck
Ol' Dirty Bastard
U-God
Masta Killa
Cappadonna
Redman
EPMD
Gang Starr
Big L
O.C.
Lord Finesse
Showbiz & A.G.
Pete Rock & CL Smooth
KRS-One
Big Daddy Kane
Slick Rick
LL Cool J
Run-DMC
Beastie Boys
Public Enemy
Naughty By Nature
Onyx
Mobb Deep
Nas
AZ
Big Pun
Fat Joe
Lil' Kim
Foxy Brown
The LOX
DMX
Jay-Z
Eminem
50 Cent
Lloyd Banks
Tony Yayo
Young Buck
The Game
Obie Trice
D12
Joe Budden
Joell Ortiz
KXNG Crooked
Royce da 5'9"
Styles P
Sheek Louch
Jadakiss
Cam'ron
Juelz Santana
Jim Jones
Max B
French Montana
Fabolous
Joe Budden
Papoose
Uncle Murda
Maino
Remy Ma
Fat Joe
Big Pun
N.O.R.E.
AZ
Cormega
Tragedy Khadafi
Mobb Deep
Havoc
Prodigy
Nas
Wu-Tang Clan
GZA
RZA
Raekwon
Ghostface Killah
Method Man
Inspectah Deck
Ol' Dirty Bastard
Redman
Keith Murray
EPMD
Erick Sermon
Def Squad
Hit Squad
Redman
Keith Murray
Das EFX
Kool G Rap
Big Daddy Kane
Biz Markie
MC Lyte
Queen Latifah
Salt-N-Pepa
Run-DMC
LL Cool J
Beastie Boys
KRS-One
Boogie Down Productions
Slick Rick
Rakim
Eric B. & Rakim
Whodini
Grandmaster Flash
Ice-T
Public Enemy
N.W.A
Ice Cube
Dr. Dre
Eazy-E
MC Ren
Snoop Dogg
2Pac
Warren G
Nate Dogg
Kurupt
Daz Dillinger
Tha Dogg Pound
DJ Quik
MC Eiht
King Tee
Compton's Most Wanted
Above the Law
Xzibit
WC
Mack 10
Westside Connection
The Pharcyde
Souls of Mischief
Del the Funky Homosapien
Hieroglyphics
Digital Underground
Too $hort
E-40
Spice 1
Mac Dre
Mac Mall
Keak da Sneak
Mistah F.A.B.
B-Legit
The Luniz
Yukmouth
Andre Nickatina
Rappin' 4-Tay
San Quinn
RBL Posse
C-Bo
X-Raided
Brotha Lynch Hung
The Jacka
Philthy Rich
Mozzy
Nef the Pharaoh
ALLBLACK
Kamaiyah
SOB X RBE
03 Greedo
Drakeo the Ruler
Larry June
Shoreline Mafia
OhGeesy
Remble
Vince Staples
Kendrick Lamar
Schoolboy Q
Ab-Soul
Jay Rock
Isaiah Rashad
Nipsey Hussle
Dom Kennedy
Buddy
Casey Veggies
Blu
Exile
Fashawn
The Alchemist
Madlib
MF DOOM
Quasimoto
Madvillain
J Dilla
Slum Village
Elzhi
Black Milk
Guilty Simpson
Danny Brown
Quelle Chris
Oddisee
Masta Ace
Skyzoo
Little Brother
Phonte
Rapper Big Pooh
9th Wonder
CunninLynguists
Atmosphere
Brother Ali
Aesop Rock
El-P
Cannibal Ox
Company Flow
Run the Jewels
Killer Mike
Jedi Mind Tricks
Vinnie Paz
Immortal Technique
Ill Bill
Necro
Cage
RA the Rugged Man
Pharoahe Monch
Organized Konfusion
Dilated Peoples
Jurassic 5
People Under The Stairs
The Coup
Del the Funky Homosapien
Hieroglyphics
Souls of Mischief
The Pharcyde
Digable Planets
De La Soul
A Tribe Called Quest
Jungle Brothers
Black Sheep
Brand Nubian
Gang Starr
Jeru the Damaja
Pete Rock
CL Smooth
Big L
Lord Finesse
O.C.
Showbiz & A.G.
Diamond D
Main Source
Large Professor
Nice & Smooth
Das EFX
Lords of the Underground
Black Moon
Smif-N-Wessun
Heltah Skeltah
Sean Price
Boot Camp Clik
Onyx
M.O.P.
Naughty By Nature
Leaders of the New School
Busta Rhymes
Q-Tip
Phife Dawg
Mos Def
Talib Kweli
Black Star
Reflection Eternal
Common
The Roots
Black Thought
Outkast
Goodie Mob
Andre 3000
Big Boi
Killer Mike
Ludacris
T.I.
Jeezy
Gucci Mane
Lil Jon
Ying Yang Twins
Pastor Troy
Waka Flocka Flame
Soulja Boy
Young Dro
2 Chainz
Future
Young Thug
Playboi Carti
Lil Baby
Gunna
21 Savage
Metro Boomin
Migos
Quavo
Offset
Takeoff
Rich the Kid
Famous Dex
Lil Pump
Smokepurpp
Travis Scott
Don Toliver
Lil Uzi Vert
Lil Yachty
Trippie Redd
Juice WRLD
XXXTentacion
Ski Mask the Slump God
Denzel Curry
Kodak Black
Lil Durk
King Von
G Herbo
Chief Keef
Polo G
Lil Tjay
NLE Choppa
Pooh Shiesty
Pop Smoke
Fivio Foreign
Kay Flock
Sleepy Hallow
Sheff G
A Boogie Wit da Hoodie
Bobby Shmurda
Fabolous
French Montana
Dave East
Jim Jones
Cam'ron
Juelz Santana
The LOX
Jadakiss
Styles P
Sheek Louch
Fat Joe
Big Pun
Remy Ma
DMX
Jay-Z
Nas
Eminem
50 Cent
Lloyd Banks
The Game
Joe Budden
Royce da 5'9"
Wu-Tang Clan
GZA
RZA
Raekwon
Ghostface Killah
Method Man
Redman
Gang Starr
Big L
KRS-One
Big Daddy Kane
Slick Rick
LL Cool J
Run-DMC
Ice Cube
Dr. Dre
Snoop Dogg
2Pac
E-40
Too $hort
Mac Dre
DJ Quik
Scarface
UGK
Bun B
Z-Ro
Trae tha Truth
Devin the Dude
Three 6 Mafia
Project Pat
Juicy J
8Ball & MJG
Paul Wall
Chamillionaire
Slim Thug
Mike Jones
Lil Flip
Juvenile
B.G.
Master P
Birdman
Mystikal
Boosie Badazz
Webbie
Trina
Trick Daddy
Rick Ross
Plies
Wale
Meek Mill
Yo Gotti
Moneybagg Yo
Young Dolph
Key Glock
Blac Youngsta
BlocBoy JB
Big Scarr
Gucci Mane
Jeezy
T.I.
Ludacris
Outkast
Goodie Mob
Tech N9ne
Hopsin
Joyner Lucas
NF
Token
Dizzy Wright
Jarren Benton
Rittz
Krizz Kaliko
Brotha Lynch Hung
Yelawolf
Logic
Hopsin
Joyner Lucas
Token
NF
Dizzy Wright
Jarren Benton
Rittz
Krizz Kaliko
Tech N9ne
Ces Cru
JL
Stevie Stone
Mayday
Murs
¡Mayday!
Bernz
Wrekonize
Strange Music
X-Raided
C-Bo
Brotha Lynch Hung
SPM
Lil Flip
Z-Ro
Trae tha Truth
Paul Wall
Chamillionaire
Slim Thug
Mike Jones
Devin the Dude
Scarface
Bun B
Pimp C
UGK
Geto Boys
Three 6 Mafia
Project Pat
Juicy J
Gangsta Boo
Lord Infamous
DJ Paul
Playa Fly
Tommy Wright III
Skinny Pimp
Criminal Manne
Frayser Boy
Lil Wyte
Haystak
8Ball
MJG
8Ball & MJG
Yo Gotti
Moneybagg Yo
Blac Youngsta
Young Dolph
Key Glock
Big Scarr
Duke Deuce
NLE Choppa
Pooh Shiesty
Big30
Foogiano
Gloss Up
Kenny Muney
Snupe Bandz
Blockboy JB
BlocBoy JB
Moneybagg Yo
Key Glock
Young Dolph
Xavier Wulf
Chris Travis
Bones
Eddy Baker
Shakewell
Pouya
$uicideboy$
Night Lovell
Lil Ugly Mane
SpaceGhostPurrp
Denzel Curry
Robb Bank$
Nell
Yung Simmie
Cities Aviv
Freddie Gibbs
Madlib
The Alchemist
Roc Marciano
Ka
Mach-Hommy
Tha God Fahim
Westside Gunn
Conway the Machine
Benny the Butcher
Boldy James
Rome Streetz
Stove God Cooks
Armani Caesar
38 Spesh
Flee Lord
Smoke DZA
Curren$y
Trademark Da Skydiver
Young Roddy
Action Bronson
Meyhem Lauren
Your Old Droog
Willie the Kid
Estee Nack
al.divino
Elcamino
Fly Anakin
Pink Siifu
Big Kahuna OG
Nickelus F
Chester Watson
Navy Blue
MIKE
Wiki
Earl Sweatshirt
billy woods
Elucid
Armand Hammer
Quelle Chris
Open Mike Eagle
Danny Brown
JPEGMAFIA
Injury Reserve
clipping.
Death Grips
Run the Jewels
Killer Mike
El-P
Aesop Rock
MF DOOM
Homeboy Sandman
Atmosphere
Brother Ali
Little Brother
Oddisee
Masta Ace
Skyzoo
Pharoahe Monch
Jedi Mind Tricks
Vinnie Paz
Immortal Technique
Cannibal Ox
Company Flow
Del the Funky Homosapien
Hieroglyphics
Souls of Mischief
People Under The Stairs
Jurassic 5
Dilated Peoples
Quasimoto
Madlib
J Dilla
Slum Village
Black Milk
Guilty Simpson
Danny Brown
Earl Sweatshirt
Navy Blue
MIKE
Wiki
MAVI
Saba
Noname
Smino
Mick Jenkins
JID
EARTHGANG
Bas
Cozz
Omen
Lute
Jay Rock
REASON
Ab-Soul
ScHoolboy Q
Kendrick Lamar
Isaiah Rashad
Nipsey Hussle
Vince Staples
Mac Miller
Tyler, the Creator
BROCKHAMPTON
Kevin Abstract
Ameer Vann
Dom McLennon
Matt Champion
Merlyn Wood
JOBA
Denzel Curry
XXXTentacion
Ski Mask the Slump God
Pouya
$uicideboy$
Lil Peep
Lil Tracy
Wifisfuneral
Craig Xen
Night Lovell
Lil Ugly Mane
SpaceGhostPurrp
Xavier Wulf
BONES
Eddy Baker
Chris Travis
Shakewell
Germ
Ramirez
Fat Nick
Smokepurpp
Lil Pump
Famous Dex
Rich the Kid
Takeoff
Quavo
Offset
Migos
Playboi Carti
Destroy Lonely
Ken Carson
Yeat
SoFaygo
Summrs
Autumn!
Kankan
UnoTheActivist
Homixide Gang
Lancey Foux
Nettspend
OsamaSon
Xaviersobased
che
2hollis
fakemink
EsDeeKid
Rich Amiri
Lazer Dim 700
nine vicious
Dom Corleo
prettifun
Diorvsyou
NUMEKID
Lucki
Veeze
BabyTron
Babyface Ray
Rio Da Yung Og
Icewear Vezzo
RMC Mike
Baby Smoove
Peezy
Sada Baby
Skilla Baby
Kasher Quon
Doughboyz Cashout
Payroll Giovanni
BandGang Lonnie Bands
ShittyBoyz
RxkNephew
WiFiGawd
Black Kray
ZelooperZ
Bruiser Wolf
Danny Brown
Boldy James
Rome Streetz
Stove God Cooks
Westside Gunn
Conway the Machine
Benny the Butcher
Mach-Hommy
Tha God Fahim
Fly Anakin
Pink Siifu
billy woods
Armand Hammer
Elucid
Quelle Chris
Open Mike Eagle
MIKE
Navy Blue
Wiki
Earl Sweatshirt
MAVI
Saba
Noname
Smino
Mick Jenkins
redveil
Ghais Guevara
AKAI SOLO
Niontay
lojii
Sideshow
Medhane
Maxo
Injury Reserve
JPEGMAFIA
clipping.
Death Grips
Run the Jewels
Ghetts
Kano
Jme
Wiley
Dizzee Rascal
D Double E
Dave
Stormzy
Central Cee
Skepta
AJ Tracey
Giggs
Headie One
Digga D
Unknown T
K-Trap
Little Simz
Loyle Carner
Knucks
Clavish
Potter Payper
Aitch
Bugzy Malone
Nines
Skrapz
D-Block Europe
Young Adz
Dirtbike LB
Tion Wayne
Russ Millions
ArrDee
Pa Salieu
Abra Cadabra
MIST
Fredo
Loski
Dutchavelli
M1llionz
Rimzee
OFB
Bandokay
Double Lz
Krept & Konan
Sneakbo
Lowkey
Akala
Jehst
Ocean Wisdom
Roots Manuva
Foreign Beggars
Skinnyman
Jam Baxter
Leaf Dog
The Four Owls
Jul
SCH
Nekfeu
Damso
Freeze Corleone
Alpha Wann
Josman
Laylow
Hamza
PLK
Niska
Kaaris
Lacrim
Maes
Koba LaD
SDM
Leto
Vald
Lorenzo
Orelsan
Booba
Ninho
Gazo
PNL
Green Montana
Kerchak
Guy2Bezbar
Heuss L'enfoiré
Zola
Timal
Naps
Gambi
Kalash Criminel
Sofiane
Alkpote
Mac Tyer
Guizmo
Dosseh
Niro
Jok'Air
Caballero & JeanJass
Roméo Elvis
Georgio
Dinos
Lesram
Disiz
Youssoupha
Kery James
Médine
Rohff
Sniper
IAM
MC Solaar
Suprême NTM
JoeyStarr
Kool Shen
Oxmo Puccino
Akhenaton
Fonky Family
Soprano
Alonzo
Keny Arkana
La Fouine
Seth Gueko
Diam's
Sinik
Jul
SCH
Nekfeu
Damso
Freeze Corleone
Alpha Wann
Josman
Laylow
Hamza
PLK
Niska
Kaaris
Lacrim
Gradur
Rohff
Kery James
MC Solaar
IAM
Oxmo Puccino
Suprême NTM
Vald
Lorenzo
Dinos
Maes
Koba LaD
SDM
Leto
Green Montana
Werenoi
Tiakola
Zamdane
Oboy
Ziak
Gazo
Ninho
Booba
PNL
Orelsan
Tory Lanez
Pressa
Killy
88GLAM
Jazz Cartier
Kardinal Offishall
Maestro Fresh Wes
Shad
Classified
Nav
Belly
Houdini
NorthSideBenji
Smiley
Casper TNG
Lil Berete
Big Lean
ONEFOUR
Hooligan Hefs
J Emz
Perrion
Celik
Lekks
Tkay Maidza
Manu Crooks
ChillinIt
BLESSED
""".splitlines()

ANCHORS = [
    "Kendrick Lamar", "Nas", "Jay-Z", "Eminem", "Drake", "J. Cole",
    "Future", "Young Thug", "Lil Wayne", "Gucci Mane", "Chief Keef",
    "Playboi Carti", "Tyler, the Creator", "Freddie Gibbs", "Westside Gunn",
    "Joey Bada$$", "Denzel Curry", "Pop Smoke", "Central Cee", "Dave",
    "Skepta", "Ninho", "Booba", "SCH", "Headie One", "Mac Miller",
    "Vince Staples", "MF DOOM", "Aesop Rock", "Three 6 Mafia", "Scarface",
    "E-40", "Juicy J", "Soulja Boy", "Tech N9ne", "50 Cent", "DMX",
    "Cam'ron", "Jadakiss", "Raekwon", "Ghostface Killah", "Project Pat",
    "Lil Baby", "Gunna", "21 Savage", "Kodak Black", "Lil Durk",
    "Ice Cube", "Snoop Dogg", "Outkast", "Goodie Mob", "Bun B",
    "Boldy James", "Earl Sweatshirt", "billy woods", "MIKE", "Navy Blue",
    "Jul", "Damso", "Nekfeu", "Kaaris", "Ghetts", "Kano", "Digga D",
    "Veeze", "BabyTron", "Lucki", "Summrs", "SoFaygo", "Yeat",
    "Destroy Lonely", "Ken Carson", "OsamaSon", "Nettspend",
]


def distinct_names(albums):
    names = set()
    for album in albums:
        for part in catalog.re.split(r"\s+&\s+", album.get("artist") or ""):
            part = part.strip()
            if part:
                names.add(part)
    return names


def make_state(albums):
    max_id = max(album["id"] for album in albums)
    existing_titles = {catalog.normalize(album["title"]) for album in albums}
    existing_cores = {catalog.core_title(album["title"]) for album in albums}
    existing_pairs = set()
    existing_artists = set()
    for album in albums:
        artist_key = catalog.normalize(album["artist"])
        existing_pairs.add((catalog.normalize(album["title"]), artist_key))
        existing_pairs.add((catalog.core_title(album["title"]), artist_key))
        existing_artists.add(artist_key)
        for part in catalog.re.split(r"\s+&\s+", album["artist"]):
            part = part.strip()
            if part:
                existing_artists.add(catalog.normalize(part))
    return (max_id, existing_titles, existing_cores, existing_pairs, existing_artists)


def load_checkpoint():
    if not CHECKPOINT.exists():
        return None
    return json.loads(CHECKPOINT.read_text(encoding="utf-8"))


def save_checkpoint(payload):
    CHECKPOINT.parent.mkdir(parents=True, exist_ok=True)
    CHECKPOINT.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")


def write_status(names, albums, queue, last):
    STATUS.write_text(
        f"names {len(names)}\nalbums {len(albums)}\nqueue {len(queue)}\nlast {last}\n",
        encoding="utf-8",
    )


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

    for name in EXTRA_SKIP:
        hiphop.HARD_SKIP.add(catalog.normalize(name))

    albums = catalog.load_albums()
    state_box = {"state": make_state(albums)}
    names = distinct_names(albums)
    print(f"start names {len(names)} albums {len(albums)}", flush=True)
    write_status(names, albums, [], "start")

    checkpoint = load_checkpoint() or {}
    done = set(checkpoint.get("done") or [])
    queued = set(checkpoint.get("queued") or [])
    queue = list(checkpoint.get("queue") or [])
    anchors_done = bool(checkpoint.get("anchors_done"))
    radios_done = bool(checkpoint.get("radios_done"))
    retries = dict(checkpoint.get("retries") or {})
    failures = list(checkpoint.get("failures") or [])

    existing_artists = state_box["state"][4]

    def push(name):
        rel_name = (name or "").strip()
        key = catalog.normalize(rel_name)
        if (
            not key
            or key in queued
            or key in done
            or key in hiphop.HARD_SKIP
            or key in existing_artists
        ):
            return
        queued.add(key)
        queue.append(rel_name)

    def enqueue_related(artist_id, display):
        try:
            rows = hiphop.related_artists(artist_id)
        except Exception as error:
            print("  related failed", display, error, flush=True)
            return
        for row in rows:
            push((row.get("name") or "").strip())

    if not queue and not done:
        for raw in SEEDS:
            push(raw.strip())
        print(f"seed queue {len(queue)}", flush=True)

    def persist(last):
        save_checkpoint({
            "queue": queue,
            "done": sorted(done),
            "queued": sorted(queued),
            "anchors_done": anchors_done,
            "radios_done": radios_done,
            "retries": retries,
            "failures": failures[-400:],
        })
        write_status(distinct_names(albums), albums, queue, last)

    persist("queued")

    while len(distinct_names(albums)) < TARGET:
        if not queue:
            if not anchors_done:
                print("expanding anchor related artists", flush=True)
                anchors_done = True
                for anchor in ANCHORS:
                    key = catalog.normalize(anchor)
                    if key in hiphop.HARD_SKIP:
                        continue
                    try:
                        artist_id, _canon = catalog.search_artist_id(anchor)
                    except Exception as error:
                        print("  anchor search failed", anchor, error, flush=True)
                        time.sleep(0.4)
                        continue
                    if not artist_id:
                        continue
                    enqueue_related(artist_id, anchor)
                    time.sleep(0.15)
                print(f"queue after anchors {len(queue)}", flush=True)
                persist("anchors")
                continue
            if not radios_done:
                print("collecting hip-hop radio artists", flush=True)
                radios_done = True
                try:
                    for radio_name in hiphop.collect_radio_artist_names():
                        push(radio_name)
                except Exception as error:
                    print("radio collect failed", error, flush=True)
                print(f"queue after radios {len(queue)}", flush=True)
                persist("radios")
                continue
            print("queue exhausted", flush=True)
            break

        name = queue.pop(0)
        key = catalog.normalize(name)
        if not key or key in done or key in hiphop.HARD_SKIP or key in existing_artists:
            continue
        names_now = len(distinct_names(albums))
        if names_now >= TARGET:
            break
        print(f"check {name} names {names_now} albums {len(albums)} queue {len(queue)}", flush=True)
        before = len(albums)
        try:
            max_id, _added, found = hiphop.import_names(
                [name], albums, state_box["state"], enqueue_related
            )
            state_box["state"] = (
                max_id,
                state_box["state"][1],
                state_box["state"][2],
                state_box["state"][3],
                state_box["state"][4],
            )
        except Exception as error:
            print("artist failed", name, error, flush=True)
            if len(albums) != before:
                del albums[before:]
            state_box["state"] = make_state(albums)
            existing_artists = state_box["state"][4]
            retries[key] = int(retries.get(key) or 0) + 1
            if retries[key] <= 2:
                queue.append(name)
            else:
                done.add(key)
                failures.append(f"{name} (repeated errors)")
            persist(name)
            continue

        if len(albums) != before:
            hiphop.save_albums(albums)
        elif not found:
            failures.append(f"{name} (no hip-hop match or no projects)")
        done.add(key)
        names = distinct_names(albums)
        print(f"saved names {len(names)} albums {len(albums)}", flush=True)
        persist(name)
        if len(names) >= TARGET:
            break

    names = distinct_names(albums)
    hiphop.save_albums(albums)
    persist("finished")
    print(f"finished names {len(names)} albums {len(albums)} failures {len(failures)}", flush=True)
    fail_path = BASE / "data" / "fill-1000-failures.txt"
    fail_path.write_text("\n".join(failures), encoding="utf-8")


if __name__ == "__main__":
    main()
