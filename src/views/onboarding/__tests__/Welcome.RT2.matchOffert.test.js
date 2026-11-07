import en from '@/theme/strings/translations/en';
import fr from '@/theme/strings/translations/fr';

// RETOURS-TESTEUR-2 (06/11/2026, défaut 5 de CR-TRAIN5) — l'écran « Bienvenue » listait
// « 2 événements et 1 annonce offerts » : le match offert (quota MATCH 0/1 du train 5) n'y était
// pas. Les deux langues le citent.
describe('Bienvenue : ce qui est offert cite le match', () => {
  it('fr', () => {
    expect(fr.welcome.subscription.free.bullet2).toBe('2 événements, 1 match et 1 annonce offerts');
  });

  it('en', () => {
    expect(en.welcome.subscription.free.bullet2).toBe('2 free events, 1 free match and 1 free ad');
  });
});
