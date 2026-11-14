import { communautesActives, lireInterrupteur } from '../communautes';

// RECOLTE-T11 K8 (14/11/2026, Adel « 337- B ») — l'interrupteur des Communautés,
// FC_COMMUNAUTES_V1 :
// ÉTEINT par défaut (la prod), allumé seulement par « 1 », « true » ou « yes » (même lecture que
// FC_CHAT_GROUP_V1, NewConversation.js), lu à chaque appel.
// Le cas « absent » se prouve sur lireInterrupteur : dans jest, `delete process.env.X`
// ne retire rien.
afterEach(() => {
  process.env.FC_COMMUNAUTES_V1 = '';
});

test('K8-1 — absent, vide, « false », « 0 », « off » : éteint', () => {
  [undefined, null, '', 'false', '0', 'off', 'non'].forEach((valeur) => {
    expect(lireInterrupteur(valeur)).toBe(false);
  });
});

test('K8-2 — « 1 », « true », « yes » (casse et espaces libres) : allumé', () => {
  ['1', 'true', 'TRUE', ' yes '].forEach((valeur) => {
    expect(lireInterrupteur(valeur)).toBe(true);
  });
});

test('K8-3 — communautesActives suit FC_COMMUNAUTES_V1 à chaque appel', () => {
  process.env.FC_COMMUNAUTES_V1 = '1';
  expect(communautesActives()).toBe(true);
  process.env.FC_COMMUNAUTES_V1 = '0';
  expect(communautesActives()).toBe(false);
  process.env.FC_COMMUNAUTES_V1 = '';
  expect(communautesActives()).toBe(false);
});
