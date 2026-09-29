import i18n from '@/theme/strings';

// FINITIONS2 (recette emulateur du 29/09, tournee 4) — onglet Participants d'un
// match : « 1 réponses sur 1 » (capture `T4-2-participants.png`) et
// « 0 réponses sur 0 » (`T4-2-contre-epreuve-staff.png`).
//
// 🔤 La legende de la barre de reponses (`EventParticipants.js`, testID
// `AD06-barre-legende`) n'avait qu'UNE forme, au pluriel, et remplissait ses
// nombres a la main apres coup (`.replace('{{received}}', …)`) : i18next ne
// voyait jamais de `count`, donc jamais de pluriel.
//
// Ce temoin tient les DEUX bouts, sur le VRAI i18next (celui de l'app, avec son
// pluriel francais `intl-pluralrules`) :
//   1. le dictionnaire : `_one` / `_other`, et ZERO prend le singulier ;
//   2. l'ecran : la legende passe bien `count` (la doublure des temoins AD06,
//      AE02, ENCADRE et MASQUE applique desormais la meme regle — voir le bloc
//      FINITIONS2 d'AD06ParticipantsFilet.test.js).

const CLEF = 'eventDetails.participantsSummary.responses';

describe('FINITIONS2 2 — « N réponse(s) sur M » : un vrai pluriel', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('fr');
  });

  test.each([
    [0, 0, '0 réponse sur 0'],
    [1, 1, '1 réponse sur 1'],
    [1, 3, '1 réponse sur 3'],
    [2, 3, '2 réponses sur 3'],
    [9, 22, '9 réponses sur 22'],
  ])('%i reçue(s) sur %i -> « %s »', (recues, total, attendu) => {
    expect(i18n.t(CLEF, { count: recues, received: recues, total })).toBe(attendu);
  });

  test('en anglais aussi : « 1 response out of 1 », « 0 responses out of 0 »', async () => {
    await i18n.changeLanguage('en');
    try {
      expect(i18n.t(CLEF, { count: 1, received: 1, total: 1 })).toBe('1 response out of 1');
      expect(i18n.t(CLEF, { count: 0, received: 0, total: 0 })).toBe('0 responses out of 0');
    } finally {
      await i18n.changeLanguage('fr');
    }
  });
});
