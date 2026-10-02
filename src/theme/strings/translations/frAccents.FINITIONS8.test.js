/* eslint-disable max-len -- les phrases de fr.js sont citées en entier */
import fr from '@/theme/strings/translations/fr';

// FINITIONS8 · POINT 9 (tournee 9) — LES TEXTES SANS ACCENTS RELEVES PAR LA TOURNEE.
//
// « Score cumule », « Derniers matchs renseignes », « laisse d'avis », « Evenement »,
// « Trie par pertinence », « benevole »… Valeurs seulement : aucune clef n'est renommee
// (ensembles de clefs compares avant / apres dans le compte rendu du lot).
// Meme forme que frAccents.test.js (AC11).

/**
 * Les feuilles du dictionnaire.
 * @param {any} noeud
 * @param {string[]} [prefixe]
 * @returns {Array<[string, any]>}
 */
const feuilles = (noeud, prefixe = []) => Object.entries(noeud).flatMap(([clef, valeur]) => {
  const chemin = prefixe.concat(clef);
  if (valeur !== null && typeof valeur === 'object') return feuilles(valeur, chemin);
  return [[chemin.join('.'), valeur]];
});

/**
 * La valeur d'une clef.
 * @param {string} chemin
 * @returns {any}
 */
const lire = (chemin) => chemin.split('.').reduce(
  (/** @type {any} */ noeud, part) => (noeud == null ? undefined : noeud[part]),
  fr,
);

const CORRIGEES = [
  ['squadDetailsScreen.stats.cumulativeScore', 'Score cumulé'],
  ['squadDetailsScreen.stats.cumulativeScoreValue', 'Score cumulé : {{scoreFor}} - {{scoreAgainst}}'],
  ['teamDetails.perf.cumulativeScore', 'Score cumulé : {{scoreFor}} - {{scoreAgainst}}'],
  ['squadDetailsScreen.reports.latestTitle', 'Derniers matchs renseignés'],
  ['teamDetails.perf.recentTitle', 'Derniers matchs renseignés'],
  ['eventDetails.theCoachHasnTLeft', "Le coach n'a pas encore laissé d'avis individuel pour ce match."],
  ['leagueMatchDetails.captainFeedback.pendingBody', "Le capitaine n'a pas encore laissé d'avis individuel pour ce match."],
  ['eventDetails.eventFallback', 'Événement'],
  ['matchStatsPromptHost.event', 'Événement'],
  ['searchMapScreen.heading.events', 'Événements'],
  ['clubListContent.sortedByRelevance', 'Trié par pertinence'],
  ['eventListContent.sortedByRelevance', 'Trié par pertinence'],
  ['recrutementListContent.sortedByRelevance', 'Trié par pertinence'],
  ['adWizardCoachProfile.engagement.volunteer', 'Bénévole'],
  ['adWizardCoachProfile.engagement.expenses', 'Indemnisé'],
  ['adWizardCoachProfile.engagement.salaried', 'Salarié'],
  ['recruitmentAdEdit.engagement.volunteer', 'Bénévole'],
  ['requestMappers.teamInvite.invited', '{{team}} est invitée à cet événement.'],
  ['requestMappers.teamInvite.myTeamFallback', 'Ton équipe'],
  ['requestMappers.teamFallback', 'Équipe'],
  ['profile.identity.roles.coach', 'Entraîneur'],
];

// Les formes fautives relevees : aucune valeur ne doit plus les porter.
const FAUTIVES = /\bEvenements?\b|\bevenements?\b|Score cumule\b|matchs renseignes\b|laisse d'avis|Trie par pertinence|\b[Bb]enevole\b|\bIndemnise\b|\bSalarie\b|est invitee a\b/;

describe('FINITIONS8 · point 9 — les accents relevés par la tournée 9', () => {
  it.each(CORRIGEES)('%s porte son accent', (chemin, attendu) => {
    expect(lire(chemin)).toBe(attendu);
  });

  it('aucune valeur de fr.js ne porte plus une forme fautive relevée', () => {
    const fautives = feuilles(fr)
      .filter(([, valeur]) => typeof valeur === 'string' && FAUTIVES.test(valeur))
      .map(([chemin, valeur]) => `${chemin} = ${valeur}`);

    expect(fautives).toEqual([]);
  });
});
