import { useTranslation } from 'react-i18next';

import useTheme from '@/theme/themeContext';

import { useConsoleDesComplexes } from '@/services/complexe/complexeQueries';

import { COMPLEXES_GERANT } from '@/config/fonctionsMasquees';

/**
 * E-S01 — LA TUILE « COMPLEXES » DU DASHBOARD ADMIN — RESA-L5B-2 (20/10/2026), plan :1810 (« tuile
 * « Complexes » de la console, à côté de la tuile Collectivités ») ; même allure que la tuile
 * des collectivités (`useCollectivitesTile`) : le nombre de complexes, et « 2 à traiter » en
 * ORANGE (un signalement ouvert, ou un complexe créé depuis 7 jours) ; « Rien à traiter » sinon ;
 * « … » pendant la lecture, « — » si elle échoue (jamais 0). Éteint avec `COMPLEXES_GERANT` :
 * rien n'est lu (et la tuile n'est pas affichée).
 * @returns {{ accessibilityLabel: string, busy: boolean, color: string, detail: string,
 *   detailColor: string, value: string }} Ce que la tuile affiche.
 */
function useComplexesTile() {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const lecture = useConsoleDesComplexes('a-traiter', '', { enabled: Boolean(COMPLEXES_GERANT) });
  const titre = t('complexeConsole.titre', 'Complexes');
  const tuile = (/** @type {Partial<ReturnType<typeof useComplexesTile>>} */ valeurs) => ({
    busy: false,
    color: Colors.primary200,
    detail: '',
    detailColor: Colors.neutral300,
    value: '',
    ...valeurs,
    accessibilityLabel: `${titre} : ${valeurs.accessibilityLabel || ''}`,
  });

  if (lecture.isLoading) return tuile({ accessibilityLabel: '…', busy: true, value: '…' });
  const compteurs = lecture.data?.compteurs;
  if (lecture.error || !compteurs) {
    const indisponible = t('collectiviteConsole.tuile.indisponible', 'Nombre indisponible');
    return tuile({ accessibilityLabel: indisponible, detail: indisponible, value: '—' });
  }
  const total = String(Number(compteurs.tous) || 0);
  const aTraiter = Number(compteurs.aTraiter) || 0;
  if (aTraiter > 0) {
    const detail = t('complexeConsole.tuileATraiter', {
      count: aTraiter,
      defaultValue: '{{count}} à traiter',
    });
    return tuile({
      accessibilityLabel: `${total}, ${detail}`,
      color: Colors.warning500,
      detail,
      detailColor: Colors.warning500,
      value: total,
    });
  }
  const rien = t('complexeConsole.tuileRien', 'Rien à traiter');
  return tuile({ accessibilityLabel: `${total}, ${rien}`, detail: rien, value: total });
}

export default useComplexesTile;
