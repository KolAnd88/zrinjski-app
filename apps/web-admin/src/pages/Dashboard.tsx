import { useNavigate } from 'react-router-dom';
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
  const { loading, live, counts, todo } = useDashboard();

  const teamsSub = `${counts.teams} · ${counts.teamsM} ${t('common.menu')} / ${counts.teamsZ} ${t('common.women')}`;

  return (
    <div className="dash">
      {/* Utakmica u tijeku */}
      <Card accent={!!live}>
        {live ? (
          <>
            <div className="dash__live-head">
              <span className="live-dot" />
              <span className="dash__live-label">
                {t('dash.liveNow')} · {STAGE_LABEL[live.stage] ?? live.stage}
              </span>
            </div>
            <div className="dash__live-row">
              <div className="dash__team">
                <Crest code={live.homeCode} index={live.homeIndex} />
                <span className="dash__team-name">{live.homeName}</span>
              </div>
              <div className="dash__score">
                {live.homeScore} : {live.awayScore}
              </div>
              <div className="dash__team dash__team--away">
                <span className="dash__team-name">{live.awayName}</span>
                <Crest code={live.awayCode} index={live.awayIndex} />
              </div>
            </div>
          </>
        ) : (
          <div className="dash__empty">{loading ? t('common.loading') : t('dash.noLive')}</div>
        )}
      </Card>

      <Button
        variant="primary"
        size="lg"
        block
        onClick={() => navigate(live ? `/live?match=${live.id}` : '/live')}
      >
        {live ? t('dash.continueLive') : t('dash.startLive')}
      </Button>

      {/* Brojke */}
      <div className="dash__stats">
        <Card>
          <div className="stat">
            <div className="stat__num">{counts.teams}</div>
            <div className="stat__label">{teamsSub}</div>
          </div>
        </Card>
        <Card>
          <div className="stat">
            <div className="stat__num">
              {counts.played}/{counts.total}
            </div>
            <div className="stat__label">{t('dash.played')}</div>
          </div>
        </Card>
        <Card>
          <div className="stat">
            <div className="stat__num">{counts.sponsors}</div>
            <div className="stat__label">{t('dash.sponsors')}</div>
          </div>
        </Card>
      </div>

      {/* Brze akcije */}
      <section className="section">
        <h2 className="section-label section__title">{t('dash.quickActions')}</h2>
        <div className="dash__actions">
          <Button onClick={() => navigate('/live')}>{t('dash.qa.result')}</Button>
          <Button onClick={() => navigate('/notices')}>{t('dash.qa.notice')}</Button>
          <Button onClick={() => navigate('/schedule')}>{t('dash.qa.schedule')}</Button>
          <Button onClick={() => navigate('/sponsors')}>{t('dash.qa.sponsor')}</Button>
        </div>
      </section>

      {/* Za odraditi */}
      <section className="section">
        <h2 className="section-label section__title">{t('dash.todo')}</h2>
        <div className="todo">
          {todo.pendingRegistrations === 0 && todo.finishedNoBestPlayer === 0 && (
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
          {todo.finishedNoBestPlayer > 0 && (
            <button className="todo__item" onClick={() => navigate('/live')}>
              <span className="todo__check" />
              <span>{t('dash.todo.bestPlayer')}</span>
              <span className="todo__count">{todo.finishedNoBestPlayer}</span>
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
