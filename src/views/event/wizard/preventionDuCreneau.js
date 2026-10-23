import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';

import {
  isDetectionEventType,
  isMatchEventType,
  isStageEventType,
  isTournamentEventType,
  isTrainingEventType,
} from './eventWizardDetectionUtils';

/**
 * Le type d'événement dans la phrase (« ton entraînement », « ta détection ») : une clé de fr.js.
 * @param {string | undefined} typeName - Le nom du type, tel que le serveur l'envoie.
 * @returns {string} La clé.
 */
const cleDuType = (typeName) => {
  if (isTrainingEventType(typeName)) return 'entrainement';
  if (isMatchEventType(typeName)) return 'match';
  if (isTournamentEventType(typeName)) return 'tournoi';
  if (isDetectionEventType(typeName)) return 'detection';
  if (isStageEventType(typeName)) return 'stage';
  return 'evenement';
};

/**
 * 🗓️ DATESDABORD (23/10/2026, recette iPhone d'Adel, point 4) — LA PHRASE DE PRÉVENTION de
 * l'étape « Lieu » : le jour et l'heure sont déjà choisis (« Date & horaire » vient avant), donc
 * dès qu'on coche l'installation l'étape dit « Ce créneau est libre », ou « Attention, ce créneau
 * est déjà pris : tu vas devoir envoyer une demande à <gestionnaire> pour faire <ton type> ».
 * La réponse du serveur fait foi (`/facilities/:id/occupancy`) ; sans elle, rien n'est promis.
 * Quand la mairie décide, la carte orange du sélecteur le dit déjà : rien ici.
 * Témoin : __tests__/EventWizardLocation.DATESDABORD.prevention.test.js.
 * @param {(cle: string, options?: any) => string} t - La traduction.
 * @param {{
 *   gestionnaire: string | null | undefined,
 *   mairie?: boolean,
 *   occupation: { allowsImmediateConfirmation?: boolean, requiresApproval?: boolean,
 *     saturated?: boolean } | null | undefined,
 *   typeName?: string,
 * }} contexte - L'occupation lue, le gestionnaire de l'installation, le type d'événement.
 * @returns {{ pris: boolean, texte: string } | null} La phrase, ou rien.
 */
const preventionDuCreneau = (t, {
  gestionnaire, mairie = false, occupation, typeName,
}) => {
  if (!occupation || mairie) return null;
  if (!occupation.saturated) {
    return { pris: false, texte: t('eventWizard.steps.location.prevention.libre', 'Ce créneau est libre.') };
  }
  if (occupation.allowsImmediateConfirmation) {
    return {
      pris: true,
      texte: t('eventWizard.steps.location.prevention.autorise', 'Attention, ce créneau est déjà pris : {{gestionnaire}} l’autorise quand même, sans demande.', {
        gestionnaire, ...SANS_ECHAPPEMENT,
      }),
    };
  }
  return {
    pris: true,
    // eslint-disable-next-line max-len
    texte: t('eventWizard.steps.location.prevention.demande', 'Attention, ce créneau est déjà pris : tu vas devoir envoyer une demande à {{gestionnaire}} pour faire {{pour}}. Elle partira quand tu créeras l’événement.', {
      gestionnaire,
      pour: t(`eventWizard.steps.location.prevention.pour.${cleDuType(typeName)}`, 'ton événement'),
      ...SANS_ECHAPPEMENT,
    }),
  };
};

export default preventionDuCreneau;
