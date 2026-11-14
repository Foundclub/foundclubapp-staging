/**
 * COMMUNAUTES-L2 (13/11/2026, demande D76 d'Adel, maquette v3 validée le 12/11) — les règles des
 * premiers
 * écrans des communautés, sans React : qui voit l'entrée, qui voit « Nouveau groupe », ce qui part
 * au serveur.
 *
 * La serrure reste le serveur (`POST /communautes/:genre/:id/groupes` rejuge tout) : ici, on
 * n'affiche que ce
 * que le serveur dit (`peutCreer`) et on n'envoie que ce que l'écran a réglé.
 */

/**
 * RECOLTE-T11 K8 (14/11/2026, Adel « 337- B ») — l'interrupteur des Communautés, FC_COMMUNAUTES_V1.
 * ÉTEINT par défaut (la prod) : ni bouton, ni ligne de communauté, ni écran, et aucun appel à
 * `/communautes/*` ; la messagerie est celle du train 10. Allumé sur la recette : site
 * `WEB_FC_COMMUNAUTES_V1=true` (web/vite.config.ts), iPhone `FC_COMMUNAUTES_V1=1`
 * (scripts/ci/ios/preparer_build.py). Même lecture que FC_CHAT_GROUP_V1 (NewConversation.js), lue
 * à chaque appel. Témoin : __tests__/communautes.K8interrupteur.test.js.
 * @returns {boolean} Vrai si les Communautés s'affichent.
 */
export const communautesActives = () => lireInterrupteur(process.env.FC_COMMUNAUTES_V1);

/**
 * La lecture d'un interrupteur : absent, vide ou autre chose que « 1 », « true », « yes » ⇒ éteint.
 * @param {unknown} brute - La valeur de la variable.
 * @returns {boolean} Vrai si allumé.
 */
export function lireInterrupteur(brute) {
  if (brute === undefined || brute === null || brute === '') return false;
  const valeur = String(brute).trim().toLowerCase();
  return valeur === '1' || valeur === 'true' || valeur === 'yes';
}

/** Les 6 thèmes de la maquette (écran 3), dans son ordre ; mêmes valeurs que le serveur. */
export const THEMES_COMMUNAUTE = [
  'equipe',
  'parents',
  'covoiturage',
  'staff',
  'evenement',
  'libre',
];

/** Les icônes proposées (glyphes de l'app : aucun emoji, décision du 01/10). */
export const ICONES_COMMUNAUTE = [
  'users',
  'flag',
  'locationPin',
  'shieldCheck',
  'camera',
  'chartSimpleHorizontal',
];

/**
 * Les genres où l'on crée dès L2. La Ville invite (270 C) : sa création attend le lot L7 (le
 * serveur répond 409).
 */
export const GENRES_CREABLES = ['club', 'omnisport', 'complexe'];

/** Au moins 2 autres membres : un groupe compte au moins 3 personnes (règle de createGroupChat). */
export const MEMBRES_MINIMUM = 2;

/**
 * L'entrée « Communautés » de la messagerie n'existe que si le serveur rend au moins une
 * communauté.
 * Un serveur d'avant le socle (404), une erreur ou une liste vide : la messagerie reste celle
 * d'aujourd'hui.
 * @param {unknown} communautes - La réponse de `GET /communautes/mine`, ou null.
 * @returns {boolean} Vrai si l'entrée s'affiche.
 */
export const afficherEntreeCommunautes = (communautes) => (
  Array.isArray(communautes) && communautes.length > 0
);

/**
 * « Nouveau groupe » : le serveur a dit oui, et le genre se crée déjà.
 * @param {{ genre?: string, peutCreer?: boolean } | null | undefined} communaute
 * @returns {boolean} Vrai si le bouton s'affiche.
 */
export const peutCreerDans = (communaute) => (
  communaute?.peutCreer === true && GENRES_CREABLES.includes(String(communaute?.genre || ''))
);

/**
 * La Ville : le gestionnaire voit sa communauté, et une phrase dit que ses groupes arrivent avec
 * les invitations.
 * @param {{ genre?: string, peutCreer?: boolean } | null | undefined} communaute
 * @returns {boolean} Vrai pour un gestionnaire de Ville.
 */
export const creationEnAttente = (communaute) => (
  communaute?.peutCreer === true && communaute?.genre === 'ville'
);

/**
 * Étape 1 terminée : un nom et un thème connu.
 * @param {{ nom?: string, theme?: string }} reglages
 * @returns {boolean} Vrai si « Suivant » s'active.
 */
export const etapeUnPrete = ({ nom, theme }) => (
  String(nom || '').trim().length > 0 && THEMES_COMMUNAUTE.includes(String(theme || ''))
);

/**
 * Coche ou décoche un membre.
 * @param {string[]} choisis
 * @param {string} id
 * @returns {string[]} La nouvelle liste.
 */
export const basculerMembre = (choisis, id) => (
  choisis.includes(id) ? choisis.filter((x) => x !== id) : [...choisis, id]
);

/**
 * « Tout sélectionner » : tous les candidats que le serveur a rendus (il a déjà écarté les moins de
 * 13 ans, les
 * mineurs d'un groupe d'adultes, les comptes supprimés). Si tout est déjà coché, on décoche tout.
 * @param {string[]} choisis
 * @param {{ documentId: string }[]} candidats
 * @returns {string[]} La nouvelle liste.
 */
export const toutSelectionner = (choisis, candidats) => {
  const tous = (candidats || []).map((m) => m.documentId).filter(Boolean);
  return tous.length > 0 && tous.every((id) => choisis.includes(id)) ? [] : tous;
};

/**
 * Filtre « Chercher un membre » : sur le prénom et le nom, sans accents ni majuscules.
 * @template {{ firstname?: string, lastname?: string }} C
 * @param {C[]} candidats
 * @param {string} recherche
 * @returns {C[]} Les candidats qui correspondent.
 */
export const filtrerCandidats = (candidats, recherche) => {
  const plat = (/** @type {unknown} */ s) => String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  const q = plat(recherche).trim();
  if (!q) return candidats || [];
  return (candidats || []).filter((m) => plat(`${m.firstname} ${m.lastname}`).includes(q));
};

/**
 * Le corps de `POST /communautes/:genre/:id/groupes` (contrôleur du socle) : `data.{nom, theme,
 * icone, quiEcrit,
 * membres}`. L'icône n'est envoyée que si elle est choisie.
 * @param {{ nom: string, theme: string, icone?: string | null, quiEcrit: 'tous' | 'admins',
 * membres: string[] }} r
 * @returns {{ data: object }} Le corps.
 */
export const corpsDeCreation = ({
  icone, membres, nom, quiEcrit, theme,
}) => ({
  data: {
    ...(icone ? { icone } : {}),
    membres: [...new Set(membres || [])],
    nom: String(nom || '').trim(),
    quiEcrit: quiEcrit === 'admins' ? 'admins' : 'tous',
    theme,
  },
});

// ---------------------------------------------------------------------------------------------
// COMMUNAUTES-L4 (14/11/2026, maquette v3 : écrans 1, 2, 5, 8, variante A) — les écrans de lecture.
// ---------------------------------------------------------------------------------------------

/** Les thèmes réservés aux adultes (mêmes valeurs que `THEMES_ADULTES` du serveur). */
export const THEMES_ADULTES = ['parents', 'covoiturage', 'staff'];

/**
 * Écran 1 : la communauté dont cette ligne est l'Annonces (le canal du club, de l'omnisport, de la
 * Ville ou du complexe d'aujourd'hui). La ligne garde son fil ; seul son habit change.
 * @param {unknown} communautes - La réponse de `mine`, ou null.
 * @param {unknown} chatId - L'identifiant du fil de la ligne.
 * @returns {any | null} La communauté, ou null (la ligne reste celle d'aujourd'hui).
 */
export const communauteDeLaLigne = (communautes, chatId) => {
  if (!Array.isArray(communautes) || !chatId) return null;
  return communautes.find((c) => c?.annonces && String(c.annonces) === String(chatId)) || null;
};

/**
 * Les communautés qui n'ont pas (encore) de ligne dans la liste chargée : le bouton rond de L2 ne
 * sert plus qu'à elles, sinon une communauté sans Annonces visible serait inatteignable.
 * ponytail: une ligne d'une page pas encore lue compte comme absente ; le bouton s'efface quand
 * elle arrive.
 * @param {unknown} communautes - La réponse de `mine`.
 * @param {{ documentId?: string }[]} fils - Les fils chargés.
 * @returns {any[]} Les communautés sans ligne.
 */
export const communautesSansLigne = (communautes, fils) => {
  if (!Array.isArray(communautes)) return [];
  const ids = new Set((fils || []).map((f) => String(f?.documentId || '')));
  return communautes.filter((c) => !c?.annonces || !ids.has(String(c.annonces)));
};

/**
 * La pastille de la ligne : le total des non-lus de la communauté (Annonces + ses groupes), quand
 * le serveur le mesure ; sinon celle du fil d'aujourd'hui.
 * @param {any} communaute
 * @param {unknown} repli - Le compteur du fil.
 * @returns {unknown} Le compteur à montrer.
 */
export const nonLusDeLaCommunaute = (communaute, repli) => (
  communaute?.nonLus == null || !Number.isFinite(Number(communaute.nonLus))
    ? repli
    : Number(communaute.nonLus)
);

/**
 * « 5 groupes · 3 avec du nouveau » (écran 1).
 * @param {(cle: string, options?: any) => string} t
 * @param {any} communaute
 * @returns {string} Le résumé, ou '' sans groupe.
 */
export const resumeDesGroupes = (t, communaute) => {
  const nombre = (communaute?.groupes || []).length;
  if (nombre === 0) return '';
  const groupes = t('communautes.resumeGroupes', {
    count: nombre,
    defaultValue: nombre > 1 ? '{{count}} groupes' : '{{count}} groupe',
  });
  const nouveaux = Number(communaute?.groupesAvecDuNouveau) || 0;
  if (nouveaux === 0) return groupes;
  const avecDuNouveau = t('communautes.avecDuNouveau', {
    count: nouveaux,
    defaultValue: '{{count}} avec du nouveau',
  });
  return `${groupes} · ${avecDuNouveau}`;
};

/**
 * Écran 8 : un mineur connu ne voit jamais un groupe à thème d'adultes (271 A), même si le serveur
 * en rendait un (il ne le fait pas : témoins L1). Les fils d'équipe, de la Ville et d'événement
 * restent.
 * @param {any} communaute
 * @param {{ mineur?: boolean }} options
 * @returns {any[]} Les groupes à montrer.
 */
export const groupesVisibles = (communaute, { mineur = false } = {}) => (
  (communaute?.groupes || []).filter((/** @type {any} */ g) => !(
    mineur && g?.origine === 'groupe' && THEMES_ADULTES.includes(String(g?.theme || ''))
  ))
);

/**
 * Écran 2 : pourquoi je suis dans ce groupe, quand la maquette le dit à la place de l'aperçu :
 * « D'office · parent de Lina » (le fil de l'équipe de son enfant de moins de 13 ans), sinon rien.
 * « D'office » seul (la règle du groupe) ne sert qu'à défaut d'aperçu : `dOfficeSansApercu`.
 * @param {(cle: string, options?: any) => string} t
 * @param {any} groupe
 * @returns {string} La raison, ou ''.
 */
export const raisonDuGroupe = (t, groupe) => {
  const enfants = (Array.isArray(groupe?.enfants) ? groupe.enfants : []).filter(Boolean);
  if (groupe?.raison === 'parent' && enfants.length) {
    return t('communautes.dOfficeParent', {
      defaultValue: 'D’office · parent de {{prenoms}}',
      interpolation: { escapeValue: false },
      prenoms: enfants.join(t('communautes.et', ' et ')),
    });
  }
  return '';
};

/**
 * Écran 2, à défaut d'aperçu : « D'office » pour un groupe où la règle m'a fait entrer.
 * @param {(cle: string, options?: any) => string} t
 * @param {any} groupe
 * @returns {string} « D'office », ou ''.
 */
export const dOfficeSansApercu = (t, groupe) => (
  groupe?.dOffice === true ? t('communautes.dOffice', 'D’office') : ''
);

/**
 * Appui long : on quitte un groupe à thème, jamais Annonces (on coupe ses notifications), ni le fil
 * d'une équipe ou de la Ville (on y est par son rôle).
 * @param {any} groupe
 * @returns {boolean} Vrai si « Quitter le groupe » s'affiche.
 */
export const peutQuitterLeGroupe = (groupe) => groupe?.origine === 'groupe';

/**
 * Variante A : le bandeau « pourquoi tu es là » d'un complexe, pour qui l'a mis en favori (le
 * gérant ne le voit pas).
 * @param {any} communaute
 * @returns {boolean} Vrai si le bandeau s'affiche.
 */
export const bandeauDuComplexe = (communaute) => (
  communaute?.genre === 'complexe' && communaute?.pourquoi === 'favori'
);
