import en from '../translations/en';
import fr from '../translations/fr';

// ✍️ FINITIONS-VILLE — décision d'Adel `accents ok` (08/10, relayée par le chef) : deux textes du
// détail d'un sondage perdaient leurs accents (« Creé par », « Vote enregistre »).
// ROUGE avant : les valeurs fautives.
describe('FVIL — les accents du détail d’un sondage', () => {
  it('« Créé par » et « Vote enregistré » ; l’anglais était déjà juste', () => {
    expect(fr.pollDetails.createdBy).toBe('Créé par');
    expect(fr.pollDetails.voteSaved).toBe('Vote enregistré');
    expect(en.pollDetails.createdBy).toBe('Created by');
    expect(en.pollDetails.voteSaved).toBe('Vote saved');
  });
});
