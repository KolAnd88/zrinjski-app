import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { Match, Stage } from '@zrinjski/core';
import { useT } from '../i18n/I18nProvider';
import { supabase } from '../lib/supabase';
import { fetchEnterableMatches } from '../lib/data';
import { useLiveMatch } from '../features/live/useLiveMatch';
import { Crest } from '../components/ui';
import { isoToLocalHHMM } from '../lib/timeFormat';
import './Tv.css';

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

    void fetchEnterableMatches(tournamentId).then((ms) => {
      setNext(
        ms
          .filter((x) => x.id !== matchId)
          .slice(0, 2)
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

  return (
    <div className="tv">
      <div className="tv__lenta" />

      <header className="tv__top">
        <div className="tv__cup">VHMRK ZRINJSKI CUP</div>
        <div className="tv__state">
          {isLive && <span className="tv__dot" />}
          {isLive ? t('live.live') : m.status === 'finished' ? t('live.finishedBadge') : ''} · {STAGE_LABEL[m.stage]}
        </div>
        <button className="tv__exit" onClick={() => navigate(`/live?match=${matchId}`)}>
          ‹ {t('live.exitTv')}
        </button>
      </header>

      <main className="tv__main">
        <div className="tv__team">
          <Crest code={live.home?.short_code} index={live.home?.sort_order} size={150} />
          <div className="tv__teamname">{live.home?.name ?? '—'}</div>
        </div>

        <div className="tv__center">
          <div className="tv__score">
            {m.home_score} <span className="tv__colon">:</span> {m.away_score}
          </div>
          <div className="tv__meta">
            {STAGE_LABEL[m.stage]}
            {isLive && m.current_minute != null ? ` · ${m.current_minute}'` : ''}
          </div>
        </div>

        <div className="tv__team">
          <Crest code={live.away?.short_code} index={live.away?.sort_order} size={150} />
          <div className="tv__teamname">{live.away?.name ?? '—'}</div>
        </div>
      </main>

      <footer className="tv__bottom">
        <div className="tv__next">
          {next.length > 0 && (
            <>
              <span className="tv__next-label">{t('tv.next')}:</span>
              {next.map((n, i) => (
                <span key={i} className="tv__next-item">
                  {n.time} {n.label}
                </span>
              ))}
            </>
          )}
        </div>
        {sponsor && (
          <div className="tv__sponsor">
            {t('tv.sponsor')}: <span>{sponsor}</span>
          </div>
        )}
      </footer>
    </div>
  );
}
