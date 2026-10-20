import { format, isValid, parseISO } from 'date-fns';
import { enGB, fr } from 'date-fns/locale';

import localeDesFormats from '@/theme/strings/localeDesFormats';

/**
 * 🏛️ R17-EVT-1 (20/10/2026, REC17-005) — L ÉVÉNEMENT DE LA VILLE, en règles pures (sans réseau).
 *
 * Planches validées (« ok go » d'Adel, 19/10 vers 17:05) : P10-evenement-ordi, P10-evenement-tel,
 * P11-evenement-v2-tel (sans « Une réponse ? » ni « À qui ? » : R17-EVT-2),
 * P11-evenement-ou-ca-vit.
 * Décisions d'Adel : « Qui le voit ? » PAR événement en 3 niveaux (1 les clubs · 2 + une actualité,
 * dirigeants ou tous les membres · 3 + « Mon planning » et la recherche publique) ; « Quelle
 * place ? » : toute l'installation, ou aucune. « Sur plusieurs jours » : les mêmes heures chaque
 * jour. Le serveur (`api::collectivite-evenement`) juge ; ces règles disent et préparent.
 */

export const EVENEMENT_TYPES = ['manifestation', 'tournoi', 'portes_ouvertes', 'reunion', 'autre'];
// Les 3 niveaux de « Qui le voit ? », du plus discret au plus large.
export const NIVEAUX = ['clubs', 'actualite', 'public'];
export const AUDIENCES = ['dirigeants', 'membres'];
export const NOM_MAX = 80;
export const DESCRIPTION_MAX = 2000;
export const ADRESSE_MAX = 200;

const ETAPES_COMPLETES = ['quoi', 'quand', 'ou', 'place', 'qui', 'recap'];

const dateLocale = () => (localeDesFormats() === 'en-GB' ? enGB : fr);

/**
 * Les étapes du tunnel (téléphone). Depuis une case du planning d'une installation (le jour,
 * l'heure et l'installation sont choisis) : « Quel événement ? › Quelle place ? › Qui le voit ? ›
 * Récapitulatif ». Un événement « ailleurs » ne prend la place de personne : « Quelle place ? »
 * est sautée.
 * @param {{ depuisUneCase?: boolean, ailleurs?: boolean }} options - D'où part le tunnel.
 * @returns {string[]} Les clés des étapes, dans l'ordre.
 */
export const etapesDuTunnel = ({ ailleurs = false, depuisUneCase = false } = {}) => {
  const sautees = new Set([
    ...(ailleurs ? ['place'] : []),
    ...(depuisUneCase ? ['quand', 'ou'] : []),
  ]);
  return ETAPES_COMPLETES.filter((etape) => !sautees.has(etape));
};

/**
 * L'état du formulaire à l'ouverture. Depuis une case : l'installation, le jour et l'heure
 * (une heure et demie, comme « Attribuer un créneau »). Par défaut, comme la planche :
 * « Toute l'installation » et « Les clubs et une actualité » aux dirigeants.
 * @param {{ date?: string, endTime?: string, facilityId?: string, startTime?: string }} [initial]
 *   - Ce que la case du planning sait déjà (jour AAAA-MM-JJ, heures HH:MM).
 * @returns {any} L'état.
 */
export const etatInitial = (initial = {}) => ({
  adresse: '',
  ailleurs: false,
  audience: 'dirigeants',
  date: initial?.date || '',
  dateFin: '',
  description: '',
  facilityId: initial?.facilityId || null,
  heureDebut: initial?.startTime || '',
  heureFin: initial?.endTime || '',
  kind: 'manifestation',
  name: '',
  plusieursJours: false,
  takesPlace: true,
  visibility: 'actualite',
});

/**
 * L'état depuis la vue d'un événement (« Modifier »).
 * @param {any} vue - La vue de la Ville (`toGestionnaireView`).
 * @returns {any} L'état.
 */
export const etatDepuisLaVue = (vue) => ({
  ...etatInitial(),
  adresse: vue?.address || '',
  ailleurs: !vue?.facility?.documentId,
  audience: vue?.audience || 'dirigeants',
  date: vue?.startDate || '',
  dateFin: vue?.endDate && vue.endDate !== vue.startDate ? vue.endDate : '',
  description: vue?.description || '',
  facilityId: vue?.facility?.documentId || null,
  heureDebut: vue?.startTime || '',
  heureFin: vue?.endTime || '',
  kind: EVENEMENT_TYPES.includes(vue?.kind) ? vue.kind : 'autre',
  name: vue?.name || '',
  plusieursJours: Boolean(vue?.endDate && vue.endDate !== vue.startDate),
  takesPlace: Boolean(vue?.takesPlace),
  visibility: NIVEAUX.includes(vue?.visibility) ? vue.visibility : 'clubs',
});

const minutes = (/** @type {unknown} */ heure) => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(heure || '').trim());
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
};

/**
 * Les refus du formulaire (planche P10-evenement-ordi, état 10), champ par champ : des CLÉS de
 * traduction, l'écran les dit sous le champ.
 * @param {any} etat - L'état du formulaire.
 * @returns {Record<string, string>} `{ champ: clé }` ; vide si tout va bien.
 */
export const verifierEvenement = (etat) => {
  /** @type {Record<string, string>} */
  const erreurs = {};
  if (!String(etat?.name || '').trim()) erreurs.name = 'collectiviteEvenement.refus.nom';
  if (!etat?.date) erreurs.date = 'collectiviteEvenement.refus.date';
  const debut = minutes(etat?.heureDebut);
  const fin = minutes(etat?.heureFin);
  if (debut === null || fin === null) erreurs.heures = 'collectiviteEvenement.refus.heures';
  else if (fin <= debut) erreurs.heures = 'collectiviteEvenement.refus.finApresDebut';
  if (etat?.plusieursJours && (!etat?.dateFin || etat.dateFin <= etat.date)) {
    erreurs.dateFin = 'collectiviteEvenement.refus.finApresDebut';
  }
  if (etat?.ailleurs ? !String(etat?.adresse || '').trim() : !etat?.facilityId) {
    erreurs.lieu = 'collectiviteEvenement.refus.lieu';
  }
  return erreurs;
};

/**
 * Le corps envoyé au serveur (`POST/PUT /collectivites/:id/evenements`). « Ailleurs » : une
 * adresse et aucune place ; niveau 3 : l'actualité va aux membres ; niveau 1 : aucune actualité.
 * @param {any} etat - L'état du formulaire.
 * @returns {{ data: Record<string, any> }} Le corps.
 */
export const versCorpsDeLApi = (etat) => {
  let audience = null;
  if (etat?.visibility === 'actualite') {
    audience = etat.audience === 'membres' ? 'membres' : 'dirigeants';
  }
  if (etat?.visibility === 'public') audience = 'membres';
  const description = String(etat?.description || '').trim();
  return {
    data: {
      address: etat?.ailleurs ? String(etat?.adresse || '').trim() : null,
      audience,
      description: description || null,
      endDate: etat?.plusieursJours && etat?.dateFin ? etat.dateFin : null,
      endTime: etat?.heureFin,
      facilityId: etat?.ailleurs ? null : etat?.facilityId || null,
      kind: etat?.kind || 'manifestation',
      name: String(etat?.name || '').trim(),
      startDate: etat?.date,
      startTime: etat?.heureDebut,
      takesPlace: etat?.ailleurs ? false : Boolean(etat?.takesPlace),
      visibility: NIVEAUX.includes(etat?.visibility) ? etat.visibility : 'clubs',
    },
  };
};

const jourCourt = (/** @type {unknown} */ jour) => {
  const date = parseISO(String(jour || ''));
  return isValid(date) ? format(date, 'EEE d MMM', { locale: dateLocale() }) : '';
};

/**
 * « sam. 24 oct. · 10:00 – 17:00 » ; sur plusieurs jours : « du sam. 24 au dim. 25 oct. ·
 * 10:00 – 17:00 ».
 * @param {any} t - i18next.
 * @param {{ endDate?: string, endTime?: string, startDate?: string, startTime?: string }} evenement
 *   - Les jours et les heures.
 * @returns {string} La phrase.
 */
export const quandLabel = (t, evenement) => {
  const heures = `${evenement?.startTime || ''} – ${evenement?.endTime || ''}`;
  if (!evenement?.endDate || evenement.endDate === evenement.startDate) {
    return t('collectiviteEvenement.quand.unJour', '{{jour}} · {{heures}}', {
      heures,
      interpolation: { escapeValue: false },
      jour: jourCourt(evenement?.startDate),
    });
  }
  return t(
    'collectiviteEvenement.quand.plusieursJoursPhrase',
    'du {{debut}} au {{fin}} · {{heures}}',
    {
      debut: jourCourt(evenement.startDate),
      fin: jourCourt(evenement.endDate),
      heures,
      interpolation: { escapeValue: false },
    },
  );
};

/**
 * « Stade municipal · toute l'installation », « Stade municipal · à côté », ou l'adresse.
 * @param {any} t - i18next.
 * @param {{ address?: string|null, facilityName?: string|null, takesPlace?: boolean }} lieu
 *   - Le lieu.
 * @returns {string} La phrase.
 */
export const lieuLabel = (t, { address, facilityName, takesPlace }) => {
  if (!facilityName) return String(address || '');
  return takesPlace
    ? t('collectiviteEvenement.lieu.toute', '{{installation}} · toute l’installation', {
      installation: facilityName,
      interpolation: { escapeValue: false },
    })
    : t('collectiviteEvenement.lieu.aCote', '{{installation}} · à côté', {
      installation: facilityName,
      interpolation: { escapeValue: false },
    });
};

/**
 * La ligne « Qui le voit » du récapitulatif : « Les clubs », « Les clubs + actualité aux
 * dirigeants », « Les clubs + actualité à tous les membres », « Tout le monde ».
 * @param {any} t - i18next.
 * @param {{ audience?: string|null, visibility?: string }} evenement - Le niveau et l'audience.
 * @returns {string} La phrase.
 */
export const quiLeVoitLabel = (t, { audience, visibility }) => {
  if (visibility === 'public') return t('collectiviteEvenement.qui.recapPublic', 'Tout le monde');
  if (visibility === 'actualite') {
    return audience === 'membres'
      ? t('collectiviteEvenement.qui.recapMembres', 'Les clubs + actualité à tous les membres')
      : t('collectiviteEvenement.qui.recapDirigeants', 'Les clubs + actualité aux dirigeants');
  }
  return t('collectiviteEvenement.qui.recapClubs', 'Les clubs');
};

/**
 * Le titre de l'encadré des séances touchées : « 1 séance touchée », « 3 séances touchées ».
 * @param {any} t - i18next.
 * @param {number} nombre - Le nombre de séances.
 * @returns {string} Le titre.
 */
export const seancesToucheesTitre = (t, nombre) => (Number(nombre) === 1
  ? t('collectiviteEvenement.touchees.une', '1 séance touchée')
  : t('collectiviteEvenement.touchees.plusieurs', '{{nombre}} séances touchées', {
    nombre: Number(nombre) || 0,
  }));

/**
 * Une séance touchée (« AS Montrivage · U13, sam. 24 oct. 14:00 – 15:30 ») : un club, une équipe,
 * des heures — jamais une personne (le serveur ne rend rien d'autre).
 * @param {any} t - i18next.
 * @param {{ club?: any, date?: string, endTime?: string|null, startTime?: string,
 *   team?: any }} seance
 *   - La séance (`affected.sessions`).
 * @returns {string} La ligne.
 */
export const seanceToucheeLabel = (t, seance) => {
  const qui = [seance?.club?.name, seance?.team?.name].filter(Boolean).join(' · ');
  const heures = seance?.endTime
    ? `${seance?.startTime} – ${seance.endTime}`
    : String(seance?.startTime || '');
  return t('collectiviteEvenement.touchees.ligne', '{{qui}}, {{jour}} {{heures}}', {
    heures,
    interpolation: { escapeValue: false },
    jour: jourCourt(seance?.date),
    qui,
  });
};

/**
 * L'étiquette du bloc clair sur un planning (planche P10-planning-ordi) : « Ville · toute
 * l'installation » s'il prend la place (bloc plein), « Ville · à côté » sinon (contour).
 * @param {any} t - i18next.
 * @param {{ takesPlace?: boolean }} evenement - L'événement.
 * @returns {string} L'étiquette.
 */
export const etiquetteDuPlanning = (t, evenement) => (evenement?.takesPlace
  ? t('collectiviteEvenement.planning.toute', 'Ville · toute l’installation')
  : t('collectiviteEvenement.planning.aCote', 'Ville · à côté'));

const AAAAMMJJ = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 🗓️ Les blocs des événements de la Ville sur le planning d'UNE installation
 * (`meta.evenementsDeLaVille`) : un par jour de la fenêtre, aux heures de l'événement (les mêmes
 * chaque jour). Au format d'un bloc du planning (`startAt`, `endAt`), SANS `documentId` (la grille
 * n'en fait pas une séance à ouvrir) mais avec `evenementDeLaVille` (la vue, pour le bloc clair et
 * la fiche). « Mon planning » reçoit du serveur des créneaux de la même forme.
 * @param {any[]} evenements - `meta.evenementsDeLaVille`.
 * @param {{ from: string, to: string }} plage - La fenêtre lue (AAAA-MM-JJ).
 * @returns {any[]} Les blocs.
 */
export const blocsDesEvenements = (evenements, plage) => {
  const debut = String(plage?.from || '').slice(0, 10);
  const fin = String(plage?.to || '').slice(0, 10);
  if (!AAAAMMJJ.test(debut) || !AAAAMMJJ.test(fin)) return [];
  return (Array.isArray(evenements) ? evenements : []).flatMap((evenement) => {
    const premier = String(evenement?.startDate || '');
    const dernier = String(evenement?.endDate || premier);
    if (!AAAAMMJJ.test(premier) || !evenement?.startTime || !evenement?.endTime) return [];
    const blocs = [];
    const jour = parseISO(premier);
    while (isValid(jour) && format(jour, 'yyyy-MM-dd') <= dernier) {
      const iso = format(jour, 'yyyy-MM-dd');
      if (iso >= debut && iso <= fin) {
        const instant = (/** @type {string} */ heure) => {
          const [h, m] = String(heure).split(':').map(Number);
          return new Date(jour.getFullYear(), jour.getMonth(), jour.getDate(), h, m).toISOString();
        };
        blocs.push({
          documentId: null,
          endAt: instant(evenement.endTime),
          evenementDeLaVille: evenement,
          hasExplicitTime: true,
          startAt: instant(evenement.startTime),
          title: evenement.name,
        });
      }
      jour.setDate(jour.getDate() + 1);
    }
    return blocs;
  });
};

/**
 * Les fermetures à dessiner, SANS les blocages liés à un événement de la Ville : le bloc clair de
 * l'événement dit déjà que la place est prise (planche P10-evenement-ordi, état 11).
 * @param {any[]} fermetures - `meta.closures`.
 * @param {any[]} evenements - `meta.evenementsDeLaVille`.
 * @returns {any[]} Les fermetures restantes.
 */
export const fermeturesSansLesEvenements = (fermetures, evenements) => {
  const lies = new Set(
    (Array.isArray(evenements) ? evenements : [])
      .map((evenement) => evenement?.closureDocumentId)
      .filter(Boolean),
  );
  return (Array.isArray(fermetures) ? fermetures : []).filter(
    (fermeture) => !fermeture?.documentId || !lies.has(fermeture.documentId),
  );
};
