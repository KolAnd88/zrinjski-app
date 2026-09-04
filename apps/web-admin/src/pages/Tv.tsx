import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { Match, Stage } from '@zrinjski/core';
import { crestPair, LENTA, lentaSvg } from '@zrinjski/ui-tokens';
import { useT } from '../i18n/I18nProvider';
import { supabase } from '../lib/supabase';
import { fetchEnterableMatches } from '../lib/data';
import { useLiveMatch } from '../features/live/useLiveMatch';
import { Crest } from '../components/ui';
import { isoToLocalHHMM } from '../lib/timeFormat';
import './Tv.css';

/** Lenta preko cijelog TV kadra. Jačina `soft` jer iza nje stoji semafor. */
function tvLenta(isFinal: boolean): string {
  const { defs, body } = lentaSvg({
    w: 1600,
    h: 900,
    strength: LENTA.strength.soft,
    gold: isFinal,
    id: 'tv',
  });
  return `<defs>${defs}</defs>${body}`;
}

const STAGE_LABEL: Record<Stage, string> = {
  group: 'GRUPA',
  semifinal: 'POLUFINALE',
  third_place: 'ZA 3. MJESTO',
  final: 'FINALE',
};

export function Tv() {
  const { t } = useT();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const matchId = params.get('match');
  const live = useLiveMatch(matchId);
  const [sponsor, setSponsor] = useState<string | null>(null);
  // Naziv turnira se ČITA, ne piše u kodu. Ovdje je stajalo zakucano
  // "VHMRK ZRINJSKI CUP" dok se turnir zvao "Ponos Hercegovine 2026" —
  // a ovaj zaslon ide na projektor, pa krivo ime vidi cijela dvorana.
  const [cup, setCup] = useState<string | null>(null);
  const [next, setNext] = useState<{ time: string; label: string }[]>([]);

  const m = live.match;
  const tournamentId = m?.tournament_id ?? null;

  useEffect(() => {
    if (!supabase || !tournamentId) return;
    void supabase
      .from('sponsor')
      .select('name')
      .eq('tournament_id', tournamentId)
      .eq('tier', 'gold')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setSponsor(data?.name ?? null));

    void supabase
      .from('tournament')
      .select('name')
      .eq('id', tournamentId)
      .maybeSingle()
      .then(({ data }) => setCup(data?.name ?? null));

    void fetchEnterableMatches(tournamentId).then((ms) => {
      setNext(
        ms
          .filter((x) => x.id !== matchId)
          .slice(0, 3)
          .map((x: Match) => ({
            time: isoToLocalHHMM(x.scheduled_time) || '—',
            label: `${x.home_placeholder ?? '—'} – ${x.away_placeholder ?? '—'}`,
          }))
      );
    });
  }, [tournamentId, matchId]);

  if (!matchId || (!live.loading && !m)) {
    return (
      <div className="tv tv--empty">
        <button className="tv__exit" onClick={() => navigate('/live')}>
          ‹ {t('live.exitTv')}
        </button>
        <div className="tv__emptymsg">{t('live.noMatches')}</div>
      </div>
    );
  }
  if (!m) return <div className="tv tv--empty">{t('common.loading')}</div>;

  const isLive = m.status === 'live';
  const isFinal = m.stage === 'final';
  const crests = crestPair(live.home?.sort_order ?? 0, live.away?.sort_order ?? 1);

  return (
    <div className="tv">
      {/* Lenta iz zajedničke definicije — ista kao na slici rezultata i plakatu.
          Zlatna nit kad je finale. */}
      <svg
        className="tv__lenta"
        viewBox="0 0 1600 900"
        preserveAspectRatio="none"
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: tvLenta(isFinal) }}
      />

      {/* Zaglavlje */}
      <header className="tv__top">
        <div className="tv__brand">
          <div className="tv__logo">ZC</div>
          {/* Tvrdi razmak dok se naziv učitava: prazan div se skupi na nultu
              visinu i podnaslov poskoči. Velika slova radi CSS, pa naziv
              izgleda isto kako god ga tko upiše u adminu. */}
          <div>
            <div className="tv__cup">{cup ?? ' '}</div>
            <div className="tv__cupsub">Turnir veterana · Bijeli Brijeg, Mostar</div>
          </div>
        </div>

        <span className="tv__spacer" />

        {isLive && (
          <div className="tv__livebadge">
            <span className="tv__dot" />
            {t('live.live')} · {STAGE_LABEL[m.stage]}
          </div>
        )}
        {isFinal && <div className="tv__goldbadge">ZA ZLATO</div>}

        <button className="tv__exit" onClick={() => navigate(`/live?match=${matchId}`)}>
          ‹ {t('live.exitTv')}
        </button>
      </header>

      {/* Rezultat */}
      <main className="tv__main">
        <div className="tv__team tv__team--home">
          <Crest code={live.home?.short_code} index={crests[0]} logoUrl={live.home?.logo_url} size={190} />
          <div className="tv__teamname">{live.home?.name ?? '—'}</div>
        </div>

        <div className="tv__center">
          <div className="tv__score">
            <span>{m.home_score}</span>
            <span className="tv__colon">:</span>
            <span>{m.away_score}</span>
          </div>
          <div className="tv__statuspill">
            <span className="tv__statustxt">{STAGE_LABEL[m.stage]}</span>
            {isLive && m.current_minute != null && (
              <>
                <span className="tv__statusdot" />
                <span className="tv__minute">{m.current_minute}'</span>
              </>
            )}
          </div>
        </div>

        <div className="tv__team tv__team--away">
          <Crest code={live.away?.short_code} index={crests[1]} logoUrl={live.away?.logo_url} size={190} />
          <div className="tv__teamname">{live.away?.name ?? '—'}</div>
        </div>
      </main>

      {/* Donja ploča — slijedi večeras */}
      {next.length > 0 && (
        <div className="tv__panelwrap">
          <div className="tv__panel">
            <div className="tv__panellabel">{t('tv.next')}</div>
            <div className="tv__nextgrid">
              {next.map((n, i) => (
                <div key={i} className="tv__nextitem">
                  <span className="tv__nexttime">{n.time}</span>
                  <span className="tv__nextsep" />
                  <span className="tv__nextlabel">{n.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Sponzor */}
      {sponsor && (
        <footer className="tv__bottom">
          <span className="tv__sponsorlabel">{t('tv.sponsor')}</span>
          <span className="tv__sponsorname">{sponsor}</span>
        </footer>
      )}
    </div>
  );
}
