import {
  applyOptimisticPollVote,
  getMyPollOptionIds,
  withMyAnonymousPollVotes,
} from './pollUseCases';

// SECU-SONDAGE-ANONYME (07/10) — UN SONDAGE ANONYME NE LIVRE PLUS SES VOTANTS (décision d'Adel
// « anonyme A »). Le serveur ne met plus, dans la composition d'un sondage anonyme, que les
// COMPTEURS : `voters` est vide pour tout le monde. « Mon choix » arrive à part, à moi seul
// (`myOptionIds`, dans la réponse du vote et dans GET /poll-voters).
//
// La couche données le pose dans la composition QUE L'APP GARDE EN CACHE, sous la forme que les
// écrans savent déjà lire : `voters: [moi]` sur mes options. Les écrans (bulle, détail) ne
// changent pas : ils surlignent `voters.includes(moi)` et comptent `voteCount`.

const MOI = 'moi';

// Un sondage anonyme tel que le serveur neuf le rend : des compteurs, aucun votant.
const anonymeDuServeur = (/** @type {any} */ surcharge = {}) => ({
  allowMultipleVotes: false,
  isAnonymous: true,
  options: [
    {
      id: 'o1', label: 'Samedi', voteCount: 3, voters: [],
    },
    {
      id: 'o2', label: 'Dimanche', voteCount: 1, voters: [],
    },
  ],
  question: 'Quel créneau ?',
  type: 'poll',
  ...surcharge,
});

// [identifiant, compteur, votants] de chaque option.
const etat = (/** @type {any} */ sondage) => sondage.options
  .map((/** @type {any} */ o) => [o.id, o.voteCount, o.voters]);

// Le vote anticipé (avant la réponse du serveur), tel que les écrans l'appellent.
const voterAvant = (/** @type {any} */ poll, /** @type {string} */ optionId) => (
  applyOptimisticPollVote({ currentUserId: MOI, optionId, poll })
);

describe('SECU-SONDAGE-ANONYME — mon choix dans un sondage anonyme', () => {
  test('1. voter dans un sondage anonyme AJOUTE ma voix au compteur, sans le vider', () => {
    const { changed, nextComposition } = voterAvant(anonymeDuServeur(), 'o1');

    expect(changed).toBe(true);
    expect(etat(nextComposition)).toEqual([['o1', 4, [MOI]], ['o2', 1, []]]);
  });

  test('2. changer d\'avis (choix unique) déplace MA voix : -1 avant, +1 après', () => {
    const avecMonChoix = withMyAnonymousPollVotes(anonymeDuServeur(), ['o2'], MOI);

    const { nextComposition } = voterAvant(avecMonChoix, 'o1');

    expect(etat(nextComposition)).toEqual([['o1', 4, [MOI]], ['o2', 0, []]]);
  });

  test('3. retoucher mon choix le retire : le compteur baisse d\'un, jamais sous zéro', () => {
    const avecMonChoix = withMyAnonymousPollVotes(anonymeDuServeur(), ['o2'], MOI);

    const { nextComposition } = voterAvant(avecMonChoix, 'o2');

    expect(etat(nextComposition)).toEqual([['o1', 3, []], ['o2', 0, []]]);
  });

  test('4. garde-fou : un sondage VISIBLE se compte toujours sur ses votants', () => {
    const visible = {
      ...anonymeDuServeur({ isAnonymous: false }),
      options: [
        {
          id: 'o1', label: 'Samedi', voteCount: 2, voters: ['a', 'b'],
        },
        {
          id: 'o2', label: 'Dimanche', voteCount: 1, voters: [MOI],
        },
      ],
    };

    const { nextComposition } = voterAvant(visible, 'o1');

    expect(etat(nextComposition)).toEqual([['o1', 3, ['a', 'b', MOI]], ['o2', 0, []]]);
  });

  test('5. poser mon choix : moi sur mes options, personne d\'autre, compteurs intacts', () => {
    const pose = withMyAnonymousPollVotes(anonymeDuServeur(), ['o2'], MOI);

    expect(etat(pose)).toEqual([['o1', 3, []], ['o2', 1, [MOI]]]);
    expect(getMyPollOptionIds(pose, MOI)).toEqual(['o2']);
    // Déjà posé : la MÊME composition revient (aucun redessin pour rien).
    expect(withMyAnonymousPollVotes(pose, ['o2'], MOI)).toBe(pose);
  });

  test('6. rien à poser (choix inconnu, sondage visible, pas un sondage) : rien ne change', () => {
    const anonyme = anonymeDuServeur();
    const visible = anonymeDuServeur({ isAnonymous: false });

    expect(withMyAnonymousPollVotes(anonyme, undefined, MOI)).toBe(anonyme);
    expect(withMyAnonymousPollVotes(anonyme, ['o1'], '')).toBe(anonyme);
    expect(withMyAnonymousPollVotes(visible, ['o1'], MOI)).toBe(visible);
    expect(withMyAnonymousPollVotes(null, ['o1'], MOI)).toBe(null);
  });
});
