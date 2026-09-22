import { isBirthdateInFuture } from '@/constants/parentalDeclaration';

// DATENAISS (2026-09-22) — UNE DATE DE NAISSANCE DANS LE FUTUR.
//
// Sentry SERVEUR-STRAPI-T, 22/09 à 00h02 heure de Paris : un vrai parent déclare
// son enfant, le serveur répond 400 « date de naissance dans le futur ». L'app
// ne testait pas le futur avant l'envoi. La règle vit ICI, à côté des paliers
// d'âge, pour que tout écran qui saisit une date de naissance la lise au même
// endroit.
//
// ⏰ LA RÉFÉRENCE EST LA DATE LOCALE DU TÉLÉPHONE, pas minuit UTC. Le parent
// raisonne sur SON calendrier : à 00h30 à Paris le 22/09, « aujourd'hui » est le
// 22/09, même si l'horloge UTC dit encore le 21.

// 22/09/2026 à 00h30, heure LOCALE (le constructeur à plusieurs arguments lit
// l'heure locale). En Europe/Paris, c'est encore le 21/09 à 22h30 UTC.
const MINUIT_ET_DEMIE = new Date(2026, 8, 22, 0, 30);

describe('DATENAISS — une date de naissance ne peut pas être dans le futur', () => {
  it('le lendemain est dans le futur', () => {
    expect(isBirthdateInFuture('2026-09-23', MINUIT_ET_DEMIE)).toBe(true);
    expect(isBirthdateInFuture('23/09/2026', MINUIT_ET_DEMIE)).toBe(true);
    expect(isBirthdateInFuture('2027-01-01', MINUIT_ET_DEMIE)).toBe(true);
  });

  it("aujourd'hui (date LOCALE) n'est pas dans le futur : un nouveau-né se déclare", () => {
    expect(isBirthdateInFuture('2026-09-22', MINUIT_ET_DEMIE)).toBe(false);
    expect(isBirthdateInFuture('22/09/2026', MINUIT_ET_DEMIE)).toBe(false);
  });

  it("le passé n'est pas dans le futur", () => {
    expect(isBirthdateInFuture('2026-09-21', MINUIT_ET_DEMIE)).toBe(false);
    expect(isBirthdateInFuture('2019-05-04', MINUIT_ET_DEMIE)).toBe(false);
  });

  it("une date illisible ne se prononce pas (les autres contrôles s'en chargent)", () => {
    expect(isBirthdateInFuture(null, MINUIT_ET_DEMIE)).toBe(false);
    expect(isBirthdateInFuture('', MINUIT_ET_DEMIE)).toBe(false);
    expect(isBirthdateInFuture('pas une date', MINUIT_ET_DEMIE)).toBe(false);
  });

  it('sans instant fourni, la référence est maintenant', () => {
    const demain = new Date();
    demain.setDate(demain.getDate() + 1);
    const iso = [
      String(demain.getFullYear()),
      String(demain.getMonth() + 1).padStart(2, '0'),
      String(demain.getDate()).padStart(2, '0'),
    ].join('-');

    expect(isBirthdateInFuture(iso)).toBe(true);
  });
});
