import { readFileSync } from 'fs';
import { join } from 'path';

import { hasActiveClubOffer } from '@/domains/subscription/subscriptionDecision';

// GUIDE-D-CORR TG-21 (tournée du 07/11, g42) : le dirigeant qui a l'offre Club en cadeau
// (`CLUB_UNVERIFIED`, club pas encore vérifié) voyait « Offre Équipe » sur « Ajouter un
// événement » et « Recruter », « Offre Club » sur « Cotisations » : l'accueil ne reconnaissait que
// `CLUB` exact. La règle d'affichage est `hasActiveClubOffer` (subscriptionDecision.js).
// Lecture du source, comme offreCotisationEquipe.test.js : l'accueil entier ne se monte pas ici.

const SOURCE = readFileSync(join(__dirname, '..', 'HomeHub.js'), 'utf8');
const bloc = (nom) => {
  const debut = SOURCE.indexOf(`const ${nom} =`);
  return SOURCE.slice(debut, SOURCE.indexOf(';', debut));
};

describe('TG-21 : le cadeau Club ne montre aucun badge d’offre', () => {
  it('la règle reconnaît le cadeau (club non vérifié)', () => {
    expect(hasActiveClubOffer('CLUB_UNVERIFIED')).toBe(true);
  });

  it.each(['teamCardPremiumScope', 'clubCardPremiumScope'])(
    '%s lit hasActiveClubOffer, pas « CLUB » exact',
    (nom) => {
      expect(bloc(nom)).not.toMatch(/=== 'CLUB'/);
      expect(bloc(nom)).toMatch(/hasClubOffer/);
    },
  );
});
