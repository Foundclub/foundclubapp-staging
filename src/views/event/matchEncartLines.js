import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';

// ==========================================================================
// 🆚 ST-MATCH (écran 1, design des statistiques validé le 02/10) — CE QUE
// L'ENCART DU SCORE DIT, ET À QUI.
//
// Sorti d'`EventDetails.js` pour une seule raison : être TESTÉ seul, sans
// monter les 10 000 lignes de l'écran (même motif que
// `peutVoirLesAvisDEntrainement`). L'écran lui passe des données déjà lues ;
// cette fonction ne lit rien, n'appelle rien, ne décide d'aucun droit d'écriture.
//
// 🔒 LA RÈGLE DE LECTURE : qui a saisi le score, ce qu'on attend et les buteurs
// ne sortent que pour l'équipe et son encadrement (`canSeeDetails`). Un visiteur
// voit le score et le résultat, rien d'autre (état 7) : des mineurs jouent en U15.
// ==========================================================================

/**
 * « Hugo L. » : le prénom et l'initiale du nom, ou le nom saisi à la main.
 * @param {any} line - Une ligne de la feuille de match.
 * @returns {string} Le nom court, ou une chaîne vide.
 */
const shortPlayerName = (line) => {
  const firstname = String(line?.user?.firstname || '').trim();
  const lastname = String(line?.user?.lastname || '').trim();
  if (firstname) return lastname ? `${firstname} ${lastname.charAt(0).toUpperCase()}.` : firstname;
  return String(line?.manualPlayerName || '').trim();
};

/**
 * 👪 DECISIONS-SOIR (02/10, « parents encart B », registre des mineurs ligne 15) — L'ÉQUIPE DE
 * SON ENFANT, pour un parent. Le SERVEUR la nomme sur la fiche d'un match
 * (`viewerParentTeamDocumentIds` : sa règle du parent, lien et âge lus en base). L'app ne juge
 * rien : elle choisit seulement l'équipe dont elle demande l'encart, et le serveur rejuge.
 * @param {any} event - L'événement : son équipe, ses équipes invitées, la clé du serveur.
 * @returns {string | null} L'équipe de ce match où joue un enfant du lecteur, ou null.
 */
export const findParentTeamId = (event) => {
  const ids = Array.isArray(event?.viewerParentTeamDocumentIds)
    ? event.viewerParentTeamDocumentIds
    : [];
  if (!ids.length) return null;
  const invitees = Array.isArray(event?.invitedTeams) ? event.invitedTeams : [];
  const team = [event?.team, ...invitees].find((t) => t?.documentId && ids.includes(t.documentId));
  return team?.documentId || null;
};

/**
 * Les buteurs d'une feuille PUBLIÉE, et les buts que personne n'a marqués.
 * « 1 but sans buteur » est l'écart entre le score et la somme des buts de la
 * feuille : la feuille ne le nomme pas, l'encart le dit.
 * @param {any[]} lines - Les lignes de la feuille de l'équipe du lecteur.
 * @param {number | null} scoreFor - Les buts de cette équipe.
 * @param {Function} t - La traduction.
 * @returns {string | null} « Hugo L. · Léo D. ×2 · 1 but sans buteur », ou rien (design 02/10).
 */
export const buildScorersLine = (lines, scoreFor, t) => {
  const scorers = (Array.isArray(lines) ? lines : [])
    .map((line) => ({ goals: Number(line?.sportPayload?.goals) || 0, name: shortPlayerName(line) }))
    .filter((scorer) => scorer.goals > 0 && scorer.name);
  const counted = scorers.reduce((total, scorer) => total + scorer.goals, 0);
  const withoutScorer = Number.isFinite(Number(scoreFor)) ? Number(scoreFor) - counted : 0;
  const parts = [
    ...scorers.map((scorer) => (
      scorer.goals > 1 ? `${scorer.name} ×${scorer.goals}` : scorer.name
    )),
    withoutScorer > 0 ? t('stMatch.encart.goalsWithoutScorer', {
      count: withoutScorer,
      defaultValue_one: '{{count}} but sans buteur',
      defaultValue_other: '{{count}} buts sans buteur',
    }) : '',
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
};

/**
 * @typedef {object} MatchEncartInput
 * @property {boolean} available - Le score est connu.
 * @property {boolean} isFinished - Le match est fini (horloge du serveur).
 * @property {boolean} waitingOfficial - Le score viendra de la fédération.
 * @property {string | null} source - 'manual', 'external_sync', 'league_validated'.
 * @property {number | null} scoreFor - Les buts de l'équipe du lecteur.
 * @property {number | null} scoreAgainst - Les buts de l'adversaire.
 * @property {string | null} startTimeLabel - L'heure du coup d'envoi (« 19:00 »).
 * @property {boolean} canSeeDetails - Membre de l'équipe, ou encadrement du club.
 * @property {boolean} canManage - Peut saisir le score (il a le bouton, pas l'attente).
 * @property {{ documentId?: string | null, firstname?: string | null } | null} recordedBy
 *   - Qui a saisi le score.
 * @property {string | null} recordedAt - Quand.
 * @property {string | null} viewerDocumentId - Le lecteur.
 * @property {string | null} coachFirstname - Le prénom de l'entraîneur de l'équipe.
 * @property {any[] | null} publishedLines - Les lignes d'une feuille PUBLIÉE (football).
 * @property {string} locale - La locale des dates.
 * @property {Function} t - La traduction.
 */

/**
 * Le centre du face-à-face et les lignes de l'encart, pour CE lecteur.
 * @param {MatchEncartInput} input - Ce que l'écran a lu.
 * @returns {{
 *   authorLine: string | null,
 *   centerLabel: string | null,
 *   isScoreShown: boolean,
 *   scorersLine: string | null,
 *   statusLine: { text: string, tone: 'neutral' | 'warning' } | null,
 *   value: string,
 * }} Ce que l'en-tête peint.
 */
export const buildMatchEncartLines = ({
  available,
  canManage,
  canSeeDetails,
  coachFirstname,
  isFinished,
  locale,
  publishedLines,
  recordedAt,
  recordedBy,
  scoreAgainst,
  scoreFor,
  source,
  startTimeLabel,
  t,
  viewerDocumentId,
  waitingOfficial,
}) => {
  // ⏳ AVANT LE MATCH (état 1) : « VS » et l'heure ; rien à saisir, rien à attendre.
  if (!available && !isFinished) {
    return {
      authorLine: null,
      centerLabel: startTimeLabel || null,
      isScoreShown: false,
      scorersLine: null,
      statusLine: null,
      value: t('stMatch.encart.versus', 'VS'),
    };
  }

  // 🕰️ FINI, SANS SCORE (états 2, 3 et 6).
  if (!available) {
    let statusLine = /** @type {{ text: string, tone: 'neutral' | 'warning' } | null} */ (null);
    if (canSeeDetails && waitingOfficial) {
      // État 6 — en orange, plus en or (défaut 15 : l'or est réservé à la League).
      statusLine = {
        text: t(
          'stMatch.encart.federationPending',
          'La fédération n\'a pas encore publié le score.',
        ),
        tone: 'warning',
      };
    } else if (canSeeDetails && !canManage) {
      // État 3 — le joueur comprend que le score viendra, et que ce n'est pas à lui.
      statusLine = {
        text: coachFirstname
          ? t('stMatch.encart.coachHasNotEntered', '{{name}} n\'a pas encore saisi le score.', {
            name: coachFirstname,
            ...SANS_ECHAPPEMENT,
          })
          : t(
            'stMatch.encart.coachHasNotEnteredUnnamed',
            'L\'entraîneur n\'a pas encore saisi le score.',
          ),
        tone: 'neutral',
      };
    }
    return {
      authorLine: null,
      centerLabel: waitingOfficial
        ? t('stMatch.encart.officialScore', 'Score officiel')
        : t('stMatch.encart.scorePending', 'Score en attente'),
      isScoreShown: false,
      scorersLine: null,
      statusLine,
      value: '– –',
    };
  }

  // 🏁 SCORE CONNU (états 4, 5, 7).
  const isOfficial = source === 'external_sync' || source === 'league_validated';
  let authorLine = null;
  if (canSeeDetails && !isOfficial && recordedAt) {
    const at = new Date(recordedAt);
    if (!Number.isNaN(at.getTime())) {
      const date = at.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
      const time = at.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
      const isViewer = Boolean(viewerDocumentId && recordedBy?.documentId === viewerDocumentId);
      const firstname = String(recordedBy?.firstname || '').trim();
      if (isViewer) {
        authorLine = t('stMatch.encart.enteredByYou', 'Saisi par toi le {{date}} à {{time}}', {
          date, time, ...SANS_ECHAPPEMENT,
        });
      } else if (firstname) {
        authorLine = t('stMatch.encart.enteredBy', 'Saisi par {{name}} le {{date}} à {{time}}', {
          date, name: firstname, time, ...SANS_ECHAPPEMENT,
        });
      } else {
        authorLine = t('stMatch.encart.enteredOn', 'Saisi le {{date}} à {{time}}', {
          date, time, ...SANS_ECHAPPEMENT,
        });
      }
    }
  }

  return {
    authorLine,
    centerLabel: isOfficial
      ? t('stMatch.encart.officialScore', 'Score officiel')
      : t('stMatch.encart.scoreEntered', 'Score saisi'),
    isScoreShown: true,
    scorersLine: canSeeDetails && Array.isArray(publishedLines)
      ? buildScorersLine(publishedLines, scoreFor, t)
      : null,
    statusLine: null,
    value: `${scoreFor} - ${scoreAgainst}`,
  };
};
