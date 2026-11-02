import { phraseDuComplet } from '../seasonSlotDisplay';

const i18next = require('i18next');

const en = require('@/theme/strings/translations/en');
const fr = require('@/theme/strings/translations/fr');

// RET-VILLE 17 (02/11, Adel « A ») — « Attribuer met 2 équipes pour 1 places, aux dates choisies » ne
// se comprenait pas, et le pluriel suivait le mauvais nombre. Les noms et les nombres varient.

const QUI = {
  AS: { club: { name: 'AS Montrivage' }, team: { name: 'U15' } },
  FC: { club: { name: 'FoundClub' } },
  MF: { club: { name: 'Montrivage FC' } },
};
const langue = i18next.default || i18next;

describe('RET-VILLE 17 — ce que dit le message du complet', () => {
  beforeAll(async () => {
    await langue.init({
      compatibilityJSON: 'v4',
      fallbackLng: 'fr',
      lng: 'fr',
      resources: { en: { translation: en.default }, fr: { translation: fr.default } },
    });
  });
  const dire = (/** @type {any[]} */ occupants, /** @type {number} */ equipes, /** @type {number} */ places) => (
    phraseDuComplet(langue.t.bind(langue), { equipes, occupants, places })
  );

  it.each([
    [[QUI.FC], 2, 1, 'Complet : FoundClub y est déjà. Si vous attribuez, 2 équipes partageront 1 place.'],
    [[QUI.AS, QUI.MF], 3, 2, 'Complet : AS Montrivage · U15 et Montrivage FC y sont déjà. Si vous attribuez, 3 équipes partageront 2 places.'],
    [[QUI.AS, QUI.MF, QUI.FC], 4, 3, 'Complet : AS Montrivage · U15, Montrivage FC et FoundClub y sont déjà. Si vous attribuez, 4 équipes partageront 3 places.'],
    [[], 2, 1, 'Complet. Si vous attribuez, 2 équipes partageront 1 place.'],
  ])('cas %#', (occupants, equipes, places, attendu) => {
    expect(dire(occupants, equipes, places)).toBe(attendu);
  });

  it('en anglais aussi, avec les pluriels justes', async () => {
    await langue.changeLanguage('en');
    expect(dire([QUI.FC], 2, 1)).toBe('Full: FoundClub is already there. If you assign, 2 teams will share 1 place.');
    expect(dire([QUI.AS, QUI.MF], 3, 2)).toBe('Full: AS Montrivage · U15 and Montrivage FC are already there. If you assign, 3 teams will share 2 places.');
    await langue.changeLanguage('fr');
  });
});
