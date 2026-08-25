import { useNavigate } from 'react-router-dom';
import { crestPair } from '@zrinjski/ui-tokens';
import { useT } from '../i18n/I18nProvider';
import { Button, Card, Crest } from '../components/ui';
import { useDashboard } from './useDashboard';
import './Dashboard.css';

const STAGE_LABEL: Record<string, string> = {
  group: 'Grupa',
  semifinal: 'Polufinale',
  third_place: 'Za 3. mjesto',
  final: 'Finale',
};

export function Dashboard() {
  const { t } = useT();
  const navigate = useNavigate();
  const { loading, live, counts, todo, queue } = useDashboard();

  const crests = live ? crestPair(live.homeIndex, live.awayIndex) : [0, 1];

  const stats = [
    {
      label: t('dash.teams'),
      value: String(counts.teams),
      sub: `${counts.teamsM} ${t('common.menu')} / ${counts.teamsZ} ${t('common.women')}`,
    },
    {
      label: t('dash.played'),
      value: `${counts.played}/${counts.total}`,
      sub: t('dash.matchesSub'),
    },
    { label: t('dash.sponsors'), value: String(counts.sponsors), sub: t('dash.sponsorsSub') },
    {
      label: t('nav.registrations'),
      value: String(todo.pendingRegistrations),
      sub: t('dash.pendingSub'),
    },
  ];

  return (
    <div className="dash">
      {/* Utakmica u tijeku */}
      {live ? (
        <div className="dash__live">
          <div className="dash__live-head">
            <span className="dash__livepill">
              <span className="live-dot" />
              {t('dash.liveNow')} · {(STAGE_LABEL[live.stage] ?? live.stage).toUpperCase()}
            </span>
            <button className="dash__fullscore" onClick={() => navigate(`/live?match=${live.id}`)}>
              {t('dash.fullScoresheet')} →
            </button>
          </div>

          <div className="dash__live-row">
            <div className="dash__team">
              <Crest code={live.homeCode} index={crests[0]} logoUrl={live.homeLogo} size={50} />
              <span className="dash__team-name">{live.homeName}</span>
            </div>
            <div className="dash__score">
              {live.homeScore} : {live.awayScore}
            </div>
            <div className="dash__team dash__team--away">
              <span className="dash__team-name">{live.awayName}</span>
              <Crest code={live.awayCode} index={crests[1]} logoUrl={live.awayLogo} size={50} />
            </div>
          </div>

          <Button
            variant="primary"
            size="lg"
            block
            style={{ marginTop: 'var(--sp-md)' }}
            onClick={() => navigate(`/live?match=${live.id}`)}
          >
            {t('dash.continueLive')}
          </Button>
        </div>
      ) : (
        <Card>
          <div className="dash__empty">{loading ? t('common.loading') : t('dash.noLive')}</div>
          <Button variant="primary" size="lg" block style={{ marginTop: 'var(--sp-md)' }} onClick={() => navigate('/live')}>
            {t('dash.startLive')}
          </Button>
        </Card>
      )}

      {/* Brojke */}
      <div className="dash__stats">
        {stats.map((s) => (
          <div key={s.label} className="statcard">
            <div className="statcard__label">{s.label}</div>
            <div className="statcard__num">{s.value}</div>
            <div className="statcard__sub">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Sljedeće u dvorani + za odraditi */}
      <div className="dash__cols">
        <section>
          <h2 className="section-label section__title">{t('dash.queue')}</h2>
          <div className="queue">
            {queue.length === 0 ? (
              <div className="queue__empty">{t('dash.queueEmpty')}</div>
            ) : (
              queue.map((q) => (
                <button key={q.id} className="queue__row" onClick={() => navigate(`/live?match=${q.id}`)}>
                  <span className="queue__time">{q.time}</span>
                  <span className="queue__stage">{STAGE_LABEL[q.stage] ?? q.stage}</span>
                  <span className="queue__label">{q.label}</span>
                </button>
              ))
            )}
          </div>
        </section>

        <section>
          <h2 className="section-label section__title">{t('dash.todo')}</h2>
          <div className="todo">
            {todo.pendingRegistrations === 0 && todo.missingMvp === 0 && (
              <div className="todo__item">
                <span className="todo__check todo__check--done">✓</span>
                <span>{t('dash.todo.allDone')}</span>
              </div>
            )}
            {todo.pendingRegistrations > 0 && (
              <button className="todo__item" onClick={() => navigate('/registrations')}>
                <span className="todo__check" />
                <span>{t('dash.todo.approve')}</span>
                <span className="todo__count">{todo.pendingRegistrations}</span>
              </button>
            )}
            {todo.missingMvp > 0 && (
              <button className="todo__item" onClick={() => navigate('/awards')}>
                <span className="todo__check" />
                <span>{t('dash.todo.bestPlayer')}</span>
                <span className="todo__count">{todo.missingMvp}</span>
              </button>
            )}
          </div>

          <h2 className="section-label section__title">{t('dash.quickActions')}</h2>
          <div className="dash__actions">
            <Button onClick={() => navigate('/schedule')}>{t('dash.qa.schedule')}</Button>
            <Button onClick={() => navigate('/notices')}>{t('dash.qa.notice')}</Button>
            <Button onClick={() => navigate('/teams')}>{t('dash.qa.teams')}</Button>
            <Button onClick={() => navigate('/sponsors')}>{t('dash.qa.sponsor')}</Button>
          </div>
        </section>
      </div>
    </div>
  );
}
