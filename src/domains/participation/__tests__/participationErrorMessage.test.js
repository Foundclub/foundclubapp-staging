import { getParticipationErrorMessage } from '@/domains/participation/participationFlow';

// AUDIT L19 (E6) — filet de caracterisation sur le message d erreur montre au
// joueur quand le serveur REFUSE sa reponse. `getParticipationErrorMessage`
// n avait aucun test, alors que c est lui qui alimente les Alert.alert de
// EventListContent (carte) et de EventDetails (modale de confirmation).
//
// Fait mesure sur ce projet : l intercepteur axios (src/services/client.native.js:89-95)
// rejette la charge Strapi DEBALLEE — `error.response` n existe plus a ce
// stade. Les fixtures ci-dessous reproduisent la forme REELLE de l objet reçu.
//
// Reference : docs/AUDIT_PARTICIPATION_2026_08_02.md, maillon M3.

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

describe('getParticipationErrorMessage (caracterisation)', () => {
  it('TROU fige — le code machine du refus est IGNORE, le message brut passe tel quel', () => {
    // `APIerrors.EVENT_USER_NOT_PLAYER_OF_TEAM_ERROR` existe pourtant dans fr.js
    // (« L'utilisateur n'est pas joueur de l'équipe. ») et `getErrorMessage`
    // de src/utils/errors/displayError.js sait le resoudre — ce helper-ci non.
    expect(getParticipationErrorMessage(rejectedByInterceptor)).toBe(
      'Error creating event participation: User is not eligible for this closed event',
    );
  });

  it('TROU fige — le repli francais ne sert jamais quand le serveur a repondu', () => {
    // Le message serveur etant toujours present, le 2e argument (le repli
    // redige en francais) est du code mort sur tout refus HTTP.
    expect(
      getParticipationErrorMessage(rejectedByInterceptor, 'Action impossible pour le moment.'),
    ).not.toBe('Action impossible pour le moment.');
  });

  it('TROU fige — la branche `error.response.data` est morte apres l intercepteur', () => {
    // Cette forme n arrive JAMAIS a ce helper : elle est deballee en amont.
    // Le test la fige pour montrer que le code qui la lit n a plus d appelant.
    const neverReachesHere = {
      response: { data: { error: { message: 'Message enveloppe' } } },
    };

    expect(getParticipationErrorMessage(neverReachesHere, 'repli')).toBe('Message enveloppe');
  });

  it('ACQUIS protege — sans erreur exploitable, le repli francais est bien rendu', () => {
    expect(getParticipationErrorMessage(null, 'Action impossible pour le moment.')).toBe(
      'Action impossible pour le moment.',
    );
    expect(getParticipationErrorMessage({}, 'Action impossible pour le moment.')).toBe(
      'Action impossible pour le moment.',
    );
  });
});
