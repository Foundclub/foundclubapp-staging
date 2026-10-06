import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';

/**
 * PARENT-PLANNING (06/10/2026, decision d Adel « parent planning oui », registre des mineurs
 * ligne 21) — les prenoms des enfants qu un evenement concerne, tels que le planning du parent
 * les ecrit : « Hugo », « Hugo et Léa », « Hugo, Léa et Tom ». Le serveur les donne
 * (`viewerChildren` sur un evenement, `meta.viewerChildren` sur la page) ; un parent de deux
 * enfants doit savoir lequel.
 * @param {Array<{ firstname?: string | null } | null | undefined> | null | undefined} children
 *   Les enfants, tels que le serveur les rend.
 * @param {any} t - La traduction (i18next).
 * @returns {string} Les prenoms, ou une chaine vide s il n y en a aucun.
 */
const formatViewerChildrenNames = (children, t) => {
  const names = (Array.isArray(children) ? children : [])
    .map((child) => String(child?.firstname || '').trim())
    .filter(Boolean);
  if (names.length <= 1) return names[0] || '';
  return t('participantEventList.childrenNames', '{{others}} et {{last}}', {
    last: names[names.length - 1],
    others: names.slice(0, -1).join(', '),
    ...SANS_ECHAPPEMENT,
  });
};

/**
 * PARENT-PLANNING (06/10, « calendrier B ») — le calendrier du parent ecrit le prenom de l enfant
 * sur chaque creneau qui le concerne : « Hugo · Entrainement U15 ». Les autres ne changent pas.
 * @param {any[]} items - Les creneaux, tels que `normalizePlanningItems` les rend (`raw` = le
 *   serveur).
 * @param {any} t - La traduction (i18next).
 * @returns {any[]} Les creneaux, titres des enfants prefixes.
 */
export const withViewerChildrenTitles = (items, t) => (Array.isArray(items) ? items : [])
  .map((item) => {
    const names = formatViewerChildrenNames(item?.raw?.viewerChildren || item?.viewerChildren, t);
    if (!names) return item;
    return {
      ...item,
      title: t('planningSlots.childEventTitle', '{{names}} · {{title}}', {
        names,
        title: item?.title || '',
        ...SANS_ECHAPPEMENT,
      }),
    };
  });

export default formatViewerChildrenNames;
