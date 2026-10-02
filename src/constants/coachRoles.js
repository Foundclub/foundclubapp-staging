/**
 * Les rôles d'entraîneur d'une annonce de recrutement
 * ===================================================
 * La VALEUR est celle que le serveur enregistre (`recruitment-ad`, énumération
 * `coachRole`) ; le LIBELLÉ est celui que le tunnel « Recruter » propose.
 *
 * RECRUTER-TUNNEL (audit V1, point H3) — « entraineur_adjoint » s'affichait brut
 * dans Mes activités › Publications, et dans le récapitulatif du tunnel. La table
 * qui le traduisait existait déjà, mais enfermée dans `AdWizardCoachProfile.js` :
 * elle en sort telle quelle, pour que chaque écran lise la même.
 */

import i18next from 'i18next';

export const COACH_ROLE_OPTIONS = [
  {
    get label() {
      return i18next.t('adWizardCoachProfile.coachRoles.main', 'Entraîneur principal');
    },
    value: 'entraineur_principal',
  },
  {
    get label() {
      return i18next.t('adWizardCoachProfile.coachRoles.assistant', 'Entraîneur adjoint');
    },
    value: 'entraineur_adjoint',
  },
  {
    get label() {
      return i18next.t('adWizardCoachProfile.coachRoles.fitness', 'Préparateur physique');
    },
    value: 'preparateur_physique',
  },
  {
    get label() {
      return i18next.t('adWizardCoachProfile.coachRoles.goalkeeper', 'Entraîneur gardiens');
    },
    value: 'entraineur_gardiens',
  },
  {
    get label() {
      return i18next.t('adWizardCoachProfile.coachRoles.videoAnalyst', 'Analyste vidéo');
    },
    value: 'analyste_video',
  },
  {
    get label() {
      return i18next.t('adWizardCoachProfile.coachRoles.teamManager', 'Team manager');
    },
    value: 'team_manager',
  },
  {
    get label() {
      return i18next.t('adWizardCoachProfile.coachRoles.other', 'Autre rôle');
    },
    value: 'other',
  },
];

/**
 * Ce qu'on lit à l'écran pour un rôle d'entraîneur — jamais la valeur technique.
 * Un rôle « autre » se lit par sa précision quand elle existe. Une valeur que la
 * table ne connaît pas reste affichée telle quelle, comme avant ce lot.
 * @param {unknown} role - La valeur enregistrée (`coachRole`).
 * @param {unknown} [roleOther] - La précision d'un rôle « autre » (`coachRoleOther`).
 * @returns {string} Le libellé ; chaîne vide si aucun rôle.
 */
export const getCoachRoleLabel = (role, roleOther) => {
  const precision = String(roleOther || '').trim();
  if (role === 'other' && precision) return precision;
  return COACH_ROLE_OPTIONS.find((option) => option.value === role)?.label
    || String(role || '').trim();
};

// FINITIONS8 (tournee 9, point 9) — « benevole » s'affichait BRUT sur la carte d'une annonce
// entraineur, « Benevole » sur sa fiche. La table du tunnel en sort, comme celle des roles.
export const ENGAGEMENT_OPTIONS = [
  {
    get label() {
      return i18next.t('adWizardCoachProfile.engagement.volunteer', 'Bénévole');
    },
    value: 'benevole',
  },
  {
    get label() {
      return i18next.t('adWizardCoachProfile.engagement.expenses', 'Indemnisé');
    },
    value: 'indemnise',
  },
  {
    get label() {
      return i18next.t('adWizardCoachProfile.engagement.salaried', 'Salarié');
    },
    value: 'salarie',
  },
  {
    get label() {
      return i18next.t('adWizardCoachProfile.engagement.toBeDefined', 'A définir');
    },
    value: 'a_definir',
  },
];

/**
 * Ce qu'on lit à l'écran pour un type d'engagement — jamais la valeur technique.
 * Une valeur que la table ne connaît pas reste affichée telle quelle.
 * @param {unknown} engagementType - La valeur enregistrée (`engagementType`).
 * @returns {string} Le libellé ; chaîne vide si aucun.
 */
export const getEngagementLabel = (engagementType) => (
  ENGAGEMENT_OPTIONS.find((option) => option.value === engagementType)?.label
  || String(engagementType || '').trim()
);
