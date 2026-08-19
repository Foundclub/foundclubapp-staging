import { getParticipationErrorMessage } from '@/domains/participation/participationFlow';

// LOT L22 (defaut D1 / audit T5) — quand le serveur REFUSE la reponse d un joueur,
// ce helper est ce qu il lit. Il alimente les Alert.alert de EventListContent
// (carte), de EventDetails (modale de confirmation) et les 13 mutations de
// useEventMutations.
//
// Ce fichier decrivait le TROU (le message anglais brut passait tel quel) ;
// il decrit maintenant le CONTRAT :
//   1. code machine traduit  -> le francais de fr.js ;
//   2. rien de traduisible   -> le repli francais de l appelant ;
//   3. jamais, dans aucun cas, la phrase brute du serveur.
//
// Le point 3 vaut AUSSI en developpement : `getErrorMessage` laisse passer le
// texte brut quand `__DEV__` est vrai, ce qui est utile au developpeur mais pas
// au joueur — or la recette tourne justement sur emulateur, ou `__DEV__` est vrai.
//
// Fait mesure sur ce projet : l intercepteur axios (src/services/client.native.js:89-95)
// rejette la charge Strapi DEBALLEE — `error.response` n existe plus a ce
// stade. Les fixtures ci-dessous reproduisent la forme REELLE de l objet reçu.
//
// Reference : docs/AUDIT_PARTICIPATION_2026_08_02.md, maillon M3 / trou T5.

// Erreur telle que l intercepteur la rejette pour un refus de participation.
const rejectedByInterceptor = {
  details: {
    code: 'EVENT_USER_NOT_PLAYER_OF_TEAM_ERROR',
    error: 'Error creating event participation: User is not eligible for this closed event',
  },
  message: 'Error creating event participation: User is not eligible for this closed event',
  name: 'BadRequestError',
  status: 400,
};

describe('getParticipationErrorMessage — le refus arrive en francais', () => {
  it('le code machine du refus est traduit par fr.js', () => {
    // W01 — la PHRASE a change, pas le contrat : ce code ne signifie qu une
    // chose cote serveur (« membre d aucune des equipes conviees »), et depuis
    // le lot U02 un encadrant MEMBRE est accepte. Nommer son role au lieu de son
    // appartenance lui faisait croire que son compte lui interdisait de repondre.
    expect(getParticipationErrorMessage(rejectedByInterceptor)).toBe(
      "Cet événement est réservé aux équipes conviées, et tu n'es membre d'aucune d'elles.",
    );
  });

  it('la phrase anglaise du serveur n est plus JAMAIS montree au joueur', () => {
    expect(getParticipationErrorMessage(rejectedByInterceptor))
      .not.toContain('Error creating event participation');

    // Meme exigence sur la forme d avant l intercepteur : quelle que soit
    // l enveloppe, le texte brut du serveur ne remonte pas a l ecran.
    expect(getParticipationErrorMessage(
      { response: { data: { error: { message: 'Something went sideways' } } } },
      'Action impossible pour le moment.',
    )).toBe('Action impossible pour le moment.');
  });

  it('code inconnu de fr.js : le repli francais de l appelant reprend la main', () => {
    // C est ce 2e argument qui etait du code mort : le message serveur gagnait
    // toujours. Il porte le seul contexte que le helper ne peut pas deviner.
    expect(getParticipationErrorMessage(
      {
        details: { code: 'UN_CODE_QUE_FR_JS_NE_CONNAIT_PAS' },
        message: 'User is not eligible',
        status: 400,
      },
      'Impossible de confirmer ta participation pour le moment.',
    )).toBe('Impossible de confirmer ta participation pour le moment.');
  });

  it('le socle commun reste branche : un 403 sans code reste « accès refusé »', () => {
    // La traduction n est pas reecrite ici, elle est deleguee a displayError.js.
    expect(getParticipationErrorMessage({ message: 'Forbidden', status: 403 }, 'repli'))
      .toBe('Accès refusé.');
  });

  it('ACQUIS protege — sans erreur exploitable, le repli francais est bien rendu', () => {
    expect(getParticipationErrorMessage(null, 'Action impossible pour le moment.')).toBe(
      'Action impossible pour le moment.',
    );
    expect(getParticipationErrorMessage({}, 'Action impossible pour le moment.')).toBe(
      'Action impossible pour le moment.',
    );
  });

  it('ACQUIS protege — repli vide : une phrase francaise par defaut, jamais du vide', () => {
    expect(getParticipationErrorMessage({}, '   ')).toBe('Action impossible pour le moment.');
  });
});
