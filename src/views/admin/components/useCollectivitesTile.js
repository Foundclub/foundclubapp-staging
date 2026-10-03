import { useTranslation } from 'react-i18next';

import { summarizeAdminCollectivites } from '@/domains/collectivite/collectiviteConsole';
import { toAdminCollectiviteRow } from '@/domains/collectivite/collectiviteDisplay';
import useTheme from '@/theme/themeContext';

import { useAdminCollectivites } from '@/services/collectivite/collectiviteQueries';

/**
 * 🏛️ LA TUILE « COLLECTIVITÉS » DU DASHBOARD ADMIN — COLL-CONSOLE (02/10/2026), planche
 * P2-console (design HY521H1, page 2, écran 1).
 *
 * La tuile disait « Mairies », un mot à la place d'un nombre. Elle porte désormais ses
 * chiffres, calculés depuis la liste des collectivités (la même lecture que la liste) :
 *   - « 1 » et « 1 active · 3 clubs couverts » ;
 *   - une mairie INACTIVE qui a déjà des clubs passe la tuile en ORANGE : « 1 à activer ·
 *     3 clubs attendent » ;
 *   - aucune : « 0 » et « Aucune mairie pour l'instant » ;
 *   - la tuile attend SEULE (« … »), au lieu de faire attendre l'écran entier ;
 *   - sa lecture échoue : « — », jamais 0 (un zéro mentirait), et « Nombre indisponible ».
 * @returns {{ accessibilityLabel: string, busy: boolean, color: string, detail: string,
 *   detailColor: string, error: unknown, value: string }} Ce que la tuile affiche.
 */
function useCollectivitesTile() {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const lecture = useAdminCollectivites();
  const titre = t('adminDashboard.cards.collectivites', 'Collectivités');
  const tuile = (/** @type {Partial<ReturnType<typeof useCollectivitesTile>>} */ valeurs) => ({
    busy: false,
    color: Colors.primary200,
    detail: '',
    detailColor: Colors.neutral300,
    error: null,
    value: '',
    ...valeurs,
    accessibilityLabel: `${titre} : ${valeurs.accessibilityLabel || ''}`,
  });

  if (lecture.isLoading) {
    return tuile({
      accessibilityLabel: t('collectiviteConsole.tuile.chargement', 'chargement'),
      busy: true,
      value: '…',
    });
  }
  if (lecture.error) {
    const indisponible = t('collectiviteConsole.tuile.indisponible', 'Nombre indisponible');
    return tuile({
      accessibilityLabel: indisponible, detail: indisponible, error: lecture.error, value: '—',
    });
  }

  const lignes = (Array.isArray(lecture.data?.data) ? lecture.data.data : [])
    .map(toAdminCollectiviteRow);
  // COLL-C6-DEMO (03/10) — la Ville de démonstration est dans la liste, pas dans le compte.
  const demos = lignes.filter((ligne) => ligne.isDemo).length;
  const total = (Number(lecture.data?.meta?.pagination?.total) || lignes.length) - demos;
  if (total === 0) {
    const aucune = t('collectiviteConsole.tuile.aucune', 'Aucune mairie pour l’instant');
    return tuile({ accessibilityLabel: aucune, detail: aucune, value: '0' });
  }

  const bilan = summarizeAdminCollectivites(lignes);
  if (bilan.toActivate > 0) {
    const detail = [
      t('collectiviteConsole.tuile.aActiver', {
        count: bilan.toActivate,
        defaultValue: '{{count}} à activer',
      }),
      t('collectiviteConsole.tuile.clubsAttendent', {
        count: bilan.clubsWaiting,
        defaultValue_one: '{{count}} club attend',
        defaultValue_other: '{{count}} clubs attendent',
      }),
    ].join(' · ');
    return tuile({
      accessibilityLabel: `${total}, ${detail}`,
      color: Colors.warning500,
      detail,
      detailColor: Colors.warning500,
      value: String(total),
    });
  }
  const detail = [
    t('collectiviteConsole.tuile.actives', {
      count: bilan.actives,
      defaultValue_one: '{{count}} active',
      defaultValue_other: '{{count}} actives',
    }),
    t('collectiviteConsole.tuile.clubsCouverts', {
      count: bilan.clubsCovered,
      defaultValue_one: '{{count}} club couvert',
      defaultValue_other: '{{count}} clubs couverts',
    }),
  ].join(' · ');
  return tuile({ accessibilityLabel: `${total}, ${detail}`, detail, value: String(total) });
}

export default useCollectivitesTile;
