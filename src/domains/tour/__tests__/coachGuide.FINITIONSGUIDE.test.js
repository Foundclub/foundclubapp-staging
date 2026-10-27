import en from '@/theme/strings/translations/en';
import fr from '@/theme/strings/translations/fr';

import { COACH_GUIDE } from '../coachGuide';

// FINITIONS-GUIDE (27/10, décision du chef) : petit écran (720x1440), M4
// « Voici les profils » : filtres et profils sont sous le pli. La bulle dit de
// faire défiler ; aucun défilement automatique.

const step = (id) => COACH_GUIDE.steps.find((candidate) => candidate.id === id);

describe('M4 « Voici les profils » : dire de faire défiler', () => {
  it.each([
    ['fr', fr.tourCatalog.coach['m4-read'], /fais défiler pour voir les profils/i],
    ['repli', step('m4-read').text, /fais défiler pour voir les profils/i],
    ['en', en.tourCatalog.coach['m4-read'], /scroll down to see the profiles/i],
  ])('%s', (_langue, texte, attendu) => {
    expect(texte).toMatch(attendu);
  });
});
