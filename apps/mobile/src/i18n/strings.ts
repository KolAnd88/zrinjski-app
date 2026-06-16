// strings.ts — prijevodi korisničke app (hr default + en). Ne hardkodiraj tekst.
export type Locale = 'hr' | 'en';

export const strings = {
  hr: {
    appName: 'VHMRK Zrinjski',

    // Donja navigacija
    'nav.home': 'Početna',
    'nav.schedule': 'Raspored',
    'nav.standings': 'Poredak',
    'nav.stats': 'Statistika',
    'nav.gallery': 'Galerija',
    'nav.info': 'Info',

    // Općenito
    'common.live': 'UŽIVO',
    'common.finished': 'ZAVRŠENO',
    'common.vs': 'vs',
    'common.loading': 'Učitavanje…',
    'common.men': 'Muški',
    'common.women': 'Žene',
    'common.map': 'Karta',
    'common.all': 'Sve',
    'common.today': 'Danas',
    'common.notConfigured': 'Podaci još nisu dostupni.',
    'common.search': 'Pretraga',
    'common.notifications': 'Obavijesti',
    'common.empty': 'Nema podataka.',
    'common.half': 'poluvrijeme',

    // Onboarding
    'onb.langTitle': 'Odaberi jezik',
    'onb.langSub': 'Language',
    'onb.followTitle': 'Prati svoju ekipu',
    'onb.followSub': 'Obavijestit ćemo te kad tvoja ekipa igra.',
    'onb.notifTitle': 'Uključi obavijesti',
    'onb.notifSub': 'Golovi, početak utakmice, promjene satnice.',
    'onb.next': 'Dalje',
    'onb.start': 'Uđi u aplikaciju',
    'onb.skip': 'Preskoči',
    'onb.enableNotif': 'Uključi obavijesti',
    'onb.later': 'Kasnije',

    // Početna
    'home.following': 'Pratiš',
    'home.liveNow': 'Uživo sada',
    'home.next': 'Sljedeće na rasporedu',
    'home.goldSponsor': 'Zlatni sponzor',
    'home.sponsors': 'Sponzori',
    'home.todayProgram': 'Današnji program',
    'home.noLive': 'Trenutno nema utakmice uživo.',
    'home.followCta': 'Odaberi ekipu koju pratiš',

    // Raspored
    'schedule.title': 'Raspored',
    'schedule.final': 'FINALE',
    'schedule.program': 'Program',

    // Poredak
    'standings.title': 'Poredak',
    'standings.played': 'Odigrano',
    'standings.advance': 'prolaze u završnicu',
    'standings.bracket': 'Završnica',
    'standings.pts': 'B',
    'standings.gd': 'GR',
    'standings.colPlayed': 'U',
    'standings.semifinal': 'Polufinale',
    'standings.thirdPlace': 'Za 3. mjesto',
    'standings.final': 'Finale',

    // Statistika
    'stats.title': 'Statistika',
    'stats.scorers': 'Strijelci',
    'stats.keepers': 'Vratari',
    'stats.suspensions': 'Isključenja',
    'stats.reds': 'Crveni kartoni',
    'stats.bestPlayer': 'Najbolji igrač turnira',
    'stats.goals': 'gol.',
    'stats.saves': 'obr.',

    // Live (gledatelj)
    'live.title': 'Tijek utakmice',
    'live.flow': 'Tijek',
    'live.rosters': 'Sastavi',
    'live.statsTab': 'Statistika',
    'live.minute': 'min',
    'live.share': 'Podijeli',

    // Detalj ekipe
    'team.squad': 'Sastav',
    'team.matches': 'Utakmice',
    'team.coach': 'Trener',
    'team.captain': 'kapetan',
    'team.group': 'Grupa',
    'team.points': 'bodova',

    // Info
    'info.about': 'O klubu',
    'info.aboutTournament': 'O turniru',
    'info.locations': 'Lokacije',
    'info.hotels': 'Hoteli',
    'info.rules': 'Pravila',
    'info.openMap': 'Otvori kartu',

    // Galerija
    'gallery.title': 'Galerija',

    // Pretraga
    'search.placeholder': 'Traži igrače, ekipe, termine…',
    'search.teams': 'Ekipe',
    'search.players': 'Igrači',
    'search.matches': 'Termini',
    'search.noResults': 'Nema rezultata.',

    // Obavijesti-postavke
    'notif.title': 'Obavijesti',
    'notif.master': 'Sve obavijesti',
    'notif.teamSoon': 'Moja ekipa igra za X min',
    'notif.teamGoal': 'Gol moje ekipe',
    'notif.matchEnd': 'Kraj utakmice',
    'notif.scheduleChange': 'Promjena satnice',
    'notif.program': 'Program i večere',
    'notif.followed': 'Praćene ekipe',
  },
  en: {
    appName: 'VHMRK Zrinjski',

    'nav.home': 'Home',
    'nav.schedule': 'Schedule',
    'nav.standings': 'Standings',
    'nav.stats': 'Stats',
    'nav.gallery': 'Gallery',
    'nav.info': 'Info',

    'common.live': 'LIVE',
    'common.finished': 'FINISHED',
    'common.vs': 'vs',
    'common.loading': 'Loading…',
    'common.men': 'Men',
    'common.women': 'Women',
    'common.map': 'Map',
    'common.all': 'All',
    'common.today': 'Today',
    'common.notConfigured': 'Data is not available yet.',
    'common.search': 'Search',
    'common.notifications': 'Notifications',
    'common.empty': 'No data.',
    'common.half': 'half',

    'onb.langTitle': 'Choose language',
    'onb.langSub': 'Jezik',
    'onb.followTitle': 'Follow your team',
    'onb.followSub': "We'll notify you when your team plays.",
    'onb.notifTitle': 'Enable notifications',
    'onb.notifSub': 'Goals, kickoff, schedule changes.',
    'onb.next': 'Next',
    'onb.start': 'Enter the app',
    'onb.skip': 'Skip',
    'onb.enableNotif': 'Enable notifications',
    'onb.later': 'Later',

    'home.following': 'Following',
    'home.liveNow': 'Live now',
    'home.next': 'Next on schedule',
    'home.goldSponsor': 'Gold sponsor',
    'home.sponsors': 'Sponsors',
    'home.todayProgram': "Today's program",
    'home.noLive': 'No live match right now.',
    'home.followCta': 'Pick a team to follow',

    'schedule.title': 'Schedule',
    'schedule.final': 'FINAL',
    'schedule.program': 'Program',

    'standings.title': 'Standings',
    'standings.played': 'Played',
    'standings.advance': 'advance to knockout',
    'standings.bracket': 'Knockout',
    'standings.pts': 'P',
    'standings.gd': 'GD',
    'standings.colPlayed': 'P',
    'standings.semifinal': 'Semifinal',
    'standings.thirdPlace': 'Third place',
    'standings.final': 'Final',

    'stats.title': 'Stats',
    'stats.scorers': 'Scorers',
    'stats.keepers': 'Keepers',
    'stats.suspensions': 'Suspensions',
    'stats.reds': 'Red cards',
    'stats.bestPlayer': 'Best player of the tournament',
    'stats.goals': 'goals',
    'stats.saves': 'saves',

    'live.title': 'Match flow',
    'live.flow': 'Flow',
    'live.rosters': 'Rosters',
    'live.statsTab': 'Stats',
    'live.minute': 'min',
    'live.share': 'Share',

    'team.squad': 'Squad',
    'team.matches': 'Matches',
    'team.coach': 'Coach',
    'team.captain': 'captain',
    'team.group': 'Group',
    'team.points': 'points',

    'info.about': 'About the club',
    'info.aboutTournament': 'About the tournament',
    'info.locations': 'Locations',
    'info.hotels': 'Hotels',
    'info.rules': 'Rules',
    'info.openMap': 'Open map',

    'gallery.title': 'Gallery',

    'search.placeholder': 'Search players, teams, fixtures…',
    'search.teams': 'Teams',
    'search.players': 'Players',
    'search.matches': 'Fixtures',
    'search.noResults': 'No results.',

    'notif.title': 'Notifications',
    'notif.master': 'All notifications',
    'notif.teamSoon': 'My team plays in X min',
    'notif.teamGoal': 'My team scores',
    'notif.matchEnd': 'Match end',
    'notif.scheduleChange': 'Schedule change',
    'notif.program': 'Program and dinners',
    'notif.followed': 'Followed teams',
  },
} as const;

export type StringKey = keyof (typeof strings)['hr'];
