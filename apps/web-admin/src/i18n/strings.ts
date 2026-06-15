// strings.ts — prijevodi. Hrvatski je default, engleski sekundarno.
// Ne hardkodiraj tekst u komponentama — dodaj ključ ovdje.

export type Locale = 'hr' | 'en';

export const strings = {
  hr: {
    appName: 'VHMRK Zrinjski',
    webAdmin: 'WEB ADMIN',

    // Auth
    'login.title': 'Prijava organizatora',
    'login.email': 'E-mail',
    'login.password': 'Lozinka',
    'login.show': 'prikaži',
    'login.hide': 'sakrij',
    'login.submit': 'Prijava',
    'login.magic': 'ili pošalji magic-link na e-mail',
    'login.note': 'Pristup samo za delegate i organizaciju.',
    'login.magicSent': 'Magic-link poslan na e-mail. Provjeri sandučić.',
    'login.signingIn': 'Prijava…',
    'login.notConfigured':
      'Supabase nije konfiguriran. Postavi VITE_SUPABASE_URL i VITE_SUPABASE_ANON_KEY u .env.',
    'login.errEmail': 'Unesi e-mail adresu.',
    'login.errCreds': 'Neispravan e-mail ili lozinka.',

    // Navigacija
    'nav.dashboard': 'Pregled',
    'nav.live': 'Uživo',
    'nav.schedule': 'Raspored',
    'nav.teams': 'Ekipe',
    'nav.tournament': 'Turnir',
    'nav.sponsors': 'Sponzori',
    'nav.notices': 'Obavijesti',
    'nav.promo': 'Promo',
    'nav.registrations': 'Prijave',
    'nav.logout': 'Odjava',

    // Nadzorna ploča
    'dash.title': 'Nadzorna ploča',
    'dash.liveNow': 'Utakmica u tijeku',
    'dash.noLive': 'Trenutno nema utakmice u tijeku.',
    'dash.continueLive': 'Nastavi unos uživo',
    'dash.startLive': 'Pokreni unos uživo',
    'dash.teams': 'ekipa',
    'dash.played': 'odigrano',
    'dash.sponsors': 'sponzora',
    'dash.quickActions': 'Brze akcije',
    'dash.qa.result': 'Unesi rezultat',
    'dash.qa.notice': 'Pošalji obavijest',
    'dash.qa.schedule': 'Generiraj satnicu',
    'dash.qa.sponsor': 'Dodaj sponzora',
    'dash.todo': 'Za odraditi',
    'dash.todo.approve': 'Odobri nove prijave',
    'dash.todo.bestPlayer': 'Postavi najboljeg igrača',
    'dash.todo.allDone': 'Sve je odrađeno.',

    // Općenito
    'common.soon': 'Uskoro',
    'common.soonNote': 'Ovaj dio gradimo u sljedećem koraku.',
    'common.loading': 'Učitavanje…',
    'common.menu': 'M',
    'common.women': 'Ž',
    'common.retry': 'Pokušaj ponovno',
  },
  en: {
    appName: 'VHMRK Zrinjski',
    webAdmin: 'WEB ADMIN',

    'login.title': 'Organizer login',
    'login.email': 'E-mail',
    'login.password': 'Password',
    'login.show': 'show',
    'login.hide': 'hide',
    'login.submit': 'Sign in',
    'login.magic': 'or send a magic link to e-mail',
    'login.note': 'Access for delegates and organization only.',
    'login.magicSent': 'Magic link sent. Check your inbox.',
    'login.signingIn': 'Signing in…',
    'login.notConfigured':
      'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.',
    'login.errEmail': 'Enter an e-mail address.',
    'login.errCreds': 'Invalid e-mail or password.',

    'nav.dashboard': 'Overview',
    'nav.live': 'Live',
    'nav.schedule': 'Schedule',
    'nav.teams': 'Teams',
    'nav.tournament': 'Tournament',
    'nav.sponsors': 'Sponsors',
    'nav.notices': 'Notices',
    'nav.promo': 'Promo',
    'nav.registrations': 'Registrations',
    'nav.logout': 'Log out',

    'dash.title': 'Dashboard',
    'dash.liveNow': 'Match in progress',
    'dash.noLive': 'No match in progress right now.',
    'dash.continueLive': 'Continue live entry',
    'dash.startLive': 'Start live entry',
    'dash.teams': 'teams',
    'dash.played': 'played',
    'dash.sponsors': 'sponsors',
    'dash.quickActions': 'Quick actions',
    'dash.qa.result': 'Enter result',
    'dash.qa.notice': 'Send notice',
    'dash.qa.schedule': 'Generate schedule',
    'dash.qa.sponsor': 'Add sponsor',
    'dash.todo': 'To do',
    'dash.todo.approve': 'Approve new registrations',
    'dash.todo.bestPlayer': 'Set best player',
    'dash.todo.allDone': 'All done.',

    'common.soon': 'Coming soon',
    'common.soonNote': 'We are building this part in the next step.',
    'common.loading': 'Loading…',
    'common.menu': 'M',
    'common.women': 'W',
    'common.retry': 'Retry',
  },
} as const;

export type StringKey = keyof (typeof strings)['hr'];
