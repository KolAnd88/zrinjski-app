import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import type { Match, Stage } from '@zrinjski/core';
import { useT } from '../i18n/I18nProvider';
import { Button, Card } from '../components/ui';
import { useTournamentData } from '../features/tournament/useTournamentData';
import { usePromo } from '../features/promo/usePromo';
import { checkPromoUrl, looksLikeApk } from '../features/promo/url';
import { autoShortCode, crestColorFor } from '../lib/crest';
import {
  downloadSvg,
  downloadSvgAsPng,
  posterSvg,
  resultCardSvg,
  type ResultCardOpts,
} from '../features/promo/svg';
import './Promo.css';

const STAGE_LABEL: Record<Stage, string> = {
  group: 'Grupa',
  semifinal: 'Polufinale',
  third_place: 'Za 3. mjesto',
  final: 'Finale',
};

/**
 * Napravi QR kod za već provjerenu adresu. `null` → nema koda.
 *
 * Dvije zaštite koje su prije nedostajale: `otkazano` sprječava da stariji
 * izračun stigne poslije novijeg, a `catch` da pri grešci na ekranu ostane
 * PRETHODNI kod. Oboje je vodilo do plakata s krivim kodom, bez ijedne poruke.
 */
function useQrCode(url: string | null): { dataUrl: string; failed: boolean } {
  const [dataUrl, setDataUrl] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!url) {
      setDataUrl('');
      setFailed(false);
      return;
    }
    let otkazano = false;
    QRCode.toDataURL(url, { margin: 1, width: 420 })
      .then((v) => {
        if (otkazano) return;
        setDataUrl(v);
        setFailed(false);
      })
      .catch(() => {
        if (otkazano) return;
        setDataUrl('');
        setFailed(true);
      });
    return () => {
      otkazano = true;
    };
  }, [url]);

  return { dataUrl, failed };
}

export function Promo() {
  const { t } = useT();
  const tournament = useTournamentData();
  const data = usePromo(tournament.tournament?.id ?? null);
  // Adrese se pamte u pregledniku: organizator ih upiše jednom, a plakat se
  // ispisuje više puta kroz turnir.
  const [url, setUrl] = useState(() => localStorage.getItem('promo.url.ios') ?? '');
  const [apkUrl, setApkUrl] = useState(() => localStorage.getItem('promo.url.apk') ?? '');
  const [matchId, setMatchId] = useState<string>('');

  const iosState = checkPromoUrl(url);
  const apkState = checkPromoUrl(apkUrl);
  const iosQr = useQrCode(iosState.key === 'ok' ? iosState.url : null);
  const apkQr = useQrCode(apkState.key === 'ok' ? apkState.url : null);
  const qr = iosQr.dataUrl;
  const qrApk = apkQr.dataUrl;

  useEffect(() => {
    localStorage.setItem('promo.url.ios', url);
  }, [url]);

  useEffect(() => {
    localStorage.setItem('promo.url.apk', apkUrl);
  }, [apkUrl]);

  useEffect(() => {
    if (!matchId && data.matches.length > 0) setMatchId(data.matches[0]!.id);
  }, [data.matches, matchId]);

  const tournamentName = tournament.tournament?.name ?? 'VHMRK Zrinjski Cup';

  const resultOpts = useMemo<ResultCardOpts | null>(() => {
    const m: Match | undefined = data.matches.find((x) => x.id === matchId);
    if (!m) return null;
    const side = (id: string | null, ph: string | null) => {
      const tm = id ? data.teamsById.get(id) : undefined;
      const name = tm?.name ?? ph ?? '—';
      return {
        name,
        code: tm?.short_code ?? autoShortCode(name),
        // Boja grba se računa iz indeksa ekipe (placeholder/nepoznata ekipa → prva boja).
        color: crestColorFor(tm?.sort_order ?? 0),
      };
    };
    const h = side(m.home_team_id, m.home_placeholder);
    const a = side(m.away_team_id, m.away_placeholder);
    return {
      homeName: h.name,
      homeCode: h.code,
      homeColor: h.color,
      awayName: a.name,
      awayCode: a.code,
      awayColor: a.color,
      homeScore: m.home_score,
      awayScore: m.away_score,
      stageLabel: `${t('promo.end')} · ${STAGE_LABEL[m.stage]}`,
      tournamentName,
      sponsorName: data.goldSponsor,
      isFinal: m.stage === 'final',
    };
  }, [matchId, data.matches, data.teamsById, data.goldSponsor, tournamentName, t]);

  if (!data.configured) return <Card style={{ maxWidth: 560 }}>{t('common.notConfigured')}</Card>;
  if (tournament.loading || data.loading) return <Card style={{ maxWidth: 560 }}>{t('common.loading')}</Card>;

  // Dva koda jer put nije isti: iPhone nema aplikaciju u trgovini pa ide na
  // web, Android skida APK. Ako je jedna adresa prazna, plakat ima samo drugi
  // kod i on je onda velik i centriran.
  const codes = [
    qr ? { qrDataUrl: qr, label: t('promo.qrIos'), hint: t('promo.qrIosHint') } : null,
    qrApk ? { qrDataUrl: qrApk, label: t('promo.qrAndroid'), hint: t('promo.qrAndroidHint') } : null,
  ].filter((x): x is NonNullable<typeof x> => !!x);

  const poster = codes.length
    ? posterSvg({ codes, headline: t('promo.qrHeadline'), sub: t('promo.qrSub'), tournamentName })
    : '';

  /** Poruka ispod polja: greška adrese ili greška izrade koda. */
  const problem = (state: ReturnType<typeof checkPromoUrl>, failed: boolean): string | null => {
    if (state.key === 'invalid') return t('promo.urlInvalid');
    if (state.key === 'notHttp') return t('promo.urlNotHttp');
    if (state.key === 'noHost') return t('promo.urlNoHost');
    if (state.key === 'tooLong') return t('promo.urlTooLong');
    if (failed) return t('promo.urlQrFailed');
    return null;
  };
  const iosProblem = problem(iosState, iosQr.failed);
  const apkProblem = problem(apkState, apkQr.failed);
  // Nevaljana adresa ne smije proći na papir — plakat se ne može ni preuzeti.
  const blocked = !!iosProblem || !!apkProblem;

  return (
    <div className="promo">
      {/* QR plakat */}
      <h2 className="section-label">{t('promo.qrTitle')}</h2>
      <Card>
        <div className="promo__qr">
          <div className="promo__codes">
            <div className="promo__code">
              <div className="promo__qrbox">{qr ? <img src={qr} alt="QR iPhone" /> : null}</div>
              <div className="promo__codelabel">{t('promo.qrIos')}</div>
            </div>
            <div className="promo__code">
              <div className="promo__qrbox">{qrApk ? <img src={qrApk} alt="QR Android" /> : null}</div>
              <div className="promo__codelabel">{t('promo.qrAndroid')}</div>
            </div>
          </div>
          <div className="promo__qrmain">
            <div className="promo__qrhead">{t('promo.qrHeadline')}</div>
            <div className="promo__qrsub">{t('promo.qrSub')}</div>

            <label className="field-label" style={{ marginTop: 'var(--sp-md)' }}>
              {t('promo.qrUrlIos')}
            </label>
            <input
              className={`input${iosProblem ? ' input--bad' : ''}`}
              value={url}
              placeholder="https://…netlify.app"
              aria-invalid={!!iosProblem}
              onChange={(e) => setUrl(e.target.value)}
            />
            {iosProblem && <p className="promo__bad">{iosProblem}</p>}

            <label className="field-label" style={{ marginTop: 'var(--sp-md)' }}>
              {t('promo.qrUrlApk')}
            </label>
            <input
              className={`input${apkProblem ? ' input--bad' : ''}`}
              value={apkUrl}
              placeholder="https://…/app.apk"
              aria-invalid={!!apkProblem}
              onChange={(e) => setApkUrl(e.target.value)}
            />
            {apkProblem && <p className="promo__bad">{apkProblem}</p>}
            {!apkProblem && !looksLikeApk(apkUrl) && (
              <p className="promo__warn">{t('promo.apkNotFile')}</p>
            )}
            <p className="promo__warn">{t('promo.qrApkWarn')}</p>

            <Button
              variant="primary"
              style={{ marginTop: 'var(--sp-md)' }}
              disabled={!poster || blocked}
              onClick={() => downloadSvg(poster, 'ponos-hercegovine-plakat.svg')}
            >
              {t('promo.download')}
            </Button>
          </div>
        </div>
      </Card>

      {/* Auto objava za mreže */}
      <div className="promo__autohead">
        <h2 className="section-label">{t('promo.autoTitle')}</h2>
        {data.matches.length > 0 && (
          <select className="input promo__pick" value={matchId} onChange={(e) => setMatchId(e.target.value)}>
            {data.matches.map((m) => {
              const hn = (m.home_team_id && data.teamsById.get(m.home_team_id)?.name) || m.home_placeholder || '—';
              const an = (m.away_team_id && data.teamsById.get(m.away_team_id)?.name) || m.away_placeholder || '—';
              return (
                <option key={m.id} value={m.id}>
                  {hn} {m.home_score}:{m.away_score} {an}
                </option>
              );
            })}
          </select>
        )}
      </div>

      {resultOpts ? (
        <Card>
          <div
            className="promo__card"
            dangerouslySetInnerHTML={{ __html: resultCardSvg(resultOpts) }}
          />
          <Button
            variant="primary"
            size="lg"
            block
            style={{ marginTop: 'var(--sp-lg)' }}
            onClick={() =>
              downloadSvgAsPng(resultCardSvg(resultOpts), 'vhmrk-zrinjski-rezultat.png', 1200, 630)
            }
          >
            {t('promo.share')}
          </Button>
          <p className="promo__note">{t('promo.autoNote')}</p>
        </Card>
      ) : (
        <div className="promo__empty">{t('promo.noFinished')}</div>
      )}
    </div>
  );
}
