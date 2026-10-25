import { getEntryCardViewModel, getEntryDetailViewModel, getListRequestConfig } from '../superadminDisplaySchema';

// BH14 (BUGHUNT 24/10/2026) — trois défauts du schéma d'affichage de la console superadmin.
describe('BH14 — schéma d affichage superadmin', () => {
  test('P2-16 : documentId, createdAt et updatedAt restent dans les champs d une liste large', () => {
    const noms = ['fullname', 'name', 'title', 'label', 'firstname', 'username', 'email', 'phoneNumber',
      'status', 'type', 'category', 'city', 'section', 'date', 'startTime', 'endTime', 'isActive',
      'validationMode', 'role', 'sport', 'capacity'];
    const attributes = noms.map((name) => ({ name, type: 'string' }));
    const { fields } = getListRequestConfig({ attributes, sortMode: 'updated', uid: 'api::truc.truc' });
    expect(fields).toEqual(expect.arrayContaining(['documentId', 'createdAt', 'updatedAt']));
    expect(fields.length).toBeLessThanOrEqual(18);
  });

  test('P2-17 : un champ « seat » n est pas lu comme une date', () => {
    const modele = getEntryDetailViewModel({
      attributes: [],
      entry: { documentId: 'x', seat: '12' },
      uid: 'api::truc.truc',
    });
    expect(modele.keyFields.find((/** @type {any} */ c) => c.key === 'seat')?.value).toBe('12');
  });

  test('P2-18 : la règle des utilisateurs s applique au vrai uid users-permissions', () => {
    const userCarte = getEntryCardViewModel({
      entry: {
        category: 'c', documentId: 'u1', preferredSport: 'foot', status: 's', type: 't',
      },
      uid: 'plugin::users-permissions.user',
    });
    expect(JSON.stringify(userCarte.fields)).toContain('preferredSport');
  });
});
