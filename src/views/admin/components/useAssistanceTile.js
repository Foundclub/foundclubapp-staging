import { useTranslation } from 'react-i18next';

import useTheme from '@/theme/themeContext';

import { useBoiteAssistance } from '@/services/chat/assistanceQueries';

/**
 * MSG-SUPPORT (20/10/2026) — LA TUILE « ASSISTANCE » DE LA CONSOLE : l'entrée de la boîte commune,
 * sur l'accueil de la console, à côté des collectivités et des complexes (même allure que
 * `useComplexesTile`). Le nombre de messages non lus, et « 2 en attente de réponse » en ORANGE ;
 * « Rien en attente » sinon ; « … » pendant la lecture, « — » si elle échoue (jamais 0).
 * @returns {{ accessibilityLabel: string, busy: boolean, color: string, detail: string,
 *   detailColor: string, value: string }} Ce que la tuile affiche.
 */
function useAssistanceTile() {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const lecture = useBoiteAssistance();
  const titre = t('assistance.console.titre', 'Assistance');
  const tuile = (/** @type {Partial<ReturnType<typeof useAssistanceTile>>} */ valeurs) => ({
    busy: false,
    color: Colors.primary200,
    detail: '',
    detailColor: Colors.neutral300,
    value: '',
    ...valeurs,
    accessibilityLabel: `${titre} : ${valeurs.accessibilityLabel || ''}`,
  });

  if (lecture.isLoading) return tuile({ accessibilityLabel: '…', busy: true, value: '…' });
  const boite = lecture.data;
  if (lecture.error || !boite) {
    const indisponible = t('collectiviteConsole.tuile.indisponible', 'Nombre indisponible');
    return tuile({ accessibilityLabel: indisponible, detail: indisponible, value: '—' });
  }
  const nonLus = String(Number(boite.nonLusTotal) || 0);
  const enAttente = Number(boite.enAttenteTotal) || 0;
  if (enAttente > 0) {
    const detail = t('assistance.console.tuileEnAttente', {
      count: enAttente,
      defaultValue: '{{count}} en attente de réponse',
    });
    return tuile({
      accessibilityLabel: `${nonLus} ${t('assistance.console.nonLus', 'non lus')}, ${detail}`,
      color: Colors.warning500,
      detail,
      detailColor: Colors.warning500,
      value: nonLus,
    });
  }
  const rien = t('assistance.console.tuileRien', 'Rien en attente');
  return tuile({
    accessibilityLabel: `${nonLus} ${t('assistance.console.nonLus', 'non lus')}, ${rien}`,
    detail: rien,
    value: nonLus,
  });
}

export default useAssistanceTile;
