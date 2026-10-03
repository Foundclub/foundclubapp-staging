import {
  collectiviteTypeLabel,
  countLabel,
  findManagedCollectivite,
  formatOpeningHours,
  formatSlot,
  isOfficialCollectiviteName,
  readCollectiviteCreateForm,
  toAdminCollectiviteDetail,
  toAdminCollectiviteRow,
  toTimeInput,
} from './collectiviteDisplay';

// COLLECTIVITES 1c — les fonctions PURES de « Ma collectivite » (aucun client HTTP).

describe('collectiviteDisplay', () => {
  it('trouve la collectivite gérée par son documentId, sinon null', () => {
    const mine = [{ documentId: 'a', name: 'Ville A' }, { documentId: 'b', name: 'Ville B' }];
    expect(findManagedCollectivite(mine, 'b')?.name).toBe('Ville B');
    expect(findManagedCollectivite(mine, 'z')).toBeNull();
    expect(findManagedCollectivite(undefined, 'a')).toBeNull();
    expect(findManagedCollectivite(mine, null)).toBeNull();
  });

  it('un nombre, « … » pendant la lecture, « — » en échec : jamais un 0 inventé', () => {
    expect(countLabel({ data: [1, 2, 3], isLoading: false })).toBe('3');
    expect(countLabel({ data: [], isLoading: false })).toBe('0');
    expect(countLabel({ isLoading: true })).toBe('…');
    expect(countLabel({ data: undefined, error: new Error('403') })).toBe('—');
    expect(countLabel(undefined)).toBe('—');
  });

  it('les horaires d ouverture : « 08:00 – 22:00 », rien s il en manque un', () => {
    expect(formatOpeningHours('08:00:00.000', '22:00:00')).toBe('08:00 – 22:00');
    expect(formatOpeningHours('08:00', null)).toBe('');
    expect(toTimeInput('07:45:00.000')).toBe('07:45');
    expect(toTimeInput(null)).toBe('');
  });

  it('le moment d une demande porte le jour et les deux heures', () => {
    const debut = new Date(2030, 9, 7, 18, 0).toISOString();
    const fin = new Date(2030, 9, 7, 19, 30).toISOString();
    expect(formatSlot(debut, fin)).toBe('lun 07/10/2030 · 18:00 – 19:30');
    expect(formatSlot('pas une date', fin)).toBe('');
  });
});

// 🏛️ D61 (29/09) — la console super-admin : ce que la liste et le detail lisent, et le
// controle de la forme OFFICIELLE du nom (D59), dont depend le bandeau « Offert par… ».
describe('collectiviteDisplay — console super-admin (D61)', () => {
  // eslint-disable-next-line max-len
  it('une ligne : isActive n est vrai que s il vaut VRAI (NULL = inactive, comme le serveur)', () => {
    const ligne = (/** @type {any} */ isActive) => toAdminCollectiviteRow({
      // eslint-disable-next-line max-len
      clubs: [{ documentId: 'a' }, { documentId: 'b' }], documentId: 'v', isActive, name: 'Ville de V', type: 'commune',
    });
    // COLL-CONSOLE-BIS (03/10) — + la date d activation (null : le serveur n en a pas).
    // COLL-C6-DEMO (03/10) — + `isDemo` (faux sans le drapeau du serveur).
    expect(ligne(null)).toEqual({
      activatedAt: null,
      clubsCount: 2,
      documentId: 'v',
      isActive: false,
      isDemo: false,
      membersCount: null,
      name: 'Ville de V',
      type: 'commune',
    });
    expect(ligne(undefined).isActive).toBe(false);
    expect(ligne('true').isActive).toBe(false);
    expect(ligne(true).isActive).toBe(true);
    expect(toAdminCollectiviteRow({ documentId: 'v' }).clubsCount).toBe(0);
  });

  // eslint-disable-next-line max-len
  it('le détail : clubs, gestionnaires (nom et e-mail seulement) et installations, triés par nom', () => {
    const detail = toAdminCollectiviteDetail({
      // eslint-disable-next-line max-len
      clubs: [{ documentId: 'z', logo: { url: '/z.png' }, name: 'Zèbre FC' }, { documentId: 'a', name: 'AS Montrivage' }],
      documentId: 'v',
      gestionnaires: [{
        // eslint-disable-next-line max-len
        documentId: 'k', email: 'k@example.invalid', firstname: 'Karim', lastname: 'Benali', phoneNumber: '0600000000',
      }],
      installations: [{
        documentId: 'g', maxSlots: 2, name: 'Gymnase des Tilleuls', type: 'Gymnase',
      }],
      isActive: true,
      name: 'Ville de Montrivage',
      type: 'commune',
    });
    // COLL-CONSOLE-BIS (03/10) — + la ville du club (null : ni SIRENE ni adresse).
    expect(detail.clubs).toEqual([
      {
        city: null, documentId: 'a', logoUrl: null, name: 'AS Montrivage',
      },
      {
        city: null, documentId: 'z', logoUrl: '/z.png', name: 'Zèbre FC',
      },
    ]);
    // eslint-disable-next-line max-len
    expect(detail.gestionnaires).toEqual([{ documentId: 'k', email: 'k@example.invalid', name: 'Karim Benali' }]);
    expect(detail.installations).toEqual([
      {
        // COLL-CONSOLE-BIS (03/10) — + la couleur du planning (null : la palette la choisit).
        documentId: 'g',
        maxSlots: 2,
        name: 'Gymnase des Tilleuls',
        planningColor: null,
        type: 'Gymnase',
      },
    ]);
    expect(toAdminCollectiviteDetail(null)).toBeNull();
  });

  it('D59 : la forme officielle se contrôle par type, majuscule comprise', () => {
    [
      ['Ville de Montrivage', 'commune'],
      ['Ville d’Aix-en-Provence', 'commune'],
      ["Ville d'Hyères", 'commune'],
      ['Ville du Havre', 'commune'],
      ['Commune des Mureaux', 'commune'],
      ['Communauté de communes du Val', 'intercommunalite'],
      ['Communauté d’agglomération Pays de Meaux', 'intercommunalite'],
      ['Métropole Aix-Marseille-Provence', 'intercommunalite'],
      ['Département du Var', 'departement'],
      ['Conseil départemental des Bouches-du-Rhône', 'departement'],
      ['Région Sud', 'region'],
    // eslint-disable-next-line max-len
    ].forEach(([nom, type]) => expect([nom, isOfficialCollectiviteName(nom, type)]).toEqual([nom, true]));
    [
      ['Montrivage', 'commune'],
      ['ville de Montrivage', 'commune'],
      ['Ville de ', 'commune'],
      ['Ville de Montrivage', 'departement'],
      ['Département du Var', 'commune'],
      ['Région Sud', 'autre'],
    // eslint-disable-next-line max-len
    ].forEach(([nom, type]) => expect([nom, isOfficialCollectiviteName(nom, type)]).toEqual([nom, false]));
  });

  it('le formulaire : les fautes nommées, le corps nettoyé, un champ vide ne part pas', () => {
    // eslint-disable-next-line max-len
    expect(readCollectiviteCreateForm({ codeInsee: '', name: 'Montrivage', type: 'commune' }).errors)
      .toEqual(['officialName', 'identifier']);
    expect(readCollectiviteCreateForm({ codeInsee: '1305', name: 'Ville de X', type: '' }).errors)
      .toEqual(['type', 'codeInsee']);
    // eslint-disable-next-line max-len
    expect(readCollectiviteCreateForm({ name: 'Ville de X', siren: '12345', type: 'commune' }).errors)
      .toEqual(['siren']);
    expect(readCollectiviteCreateForm({
      // eslint-disable-next-line max-len
      codeInsee: ' 2a004 ', email: '', name: ' Ville d’Ajaccio ', phoneNumber: ' ', siren: '217 200 014', type: 'commune',
    })).toEqual({
      data: {
        codeInsee: '2A004', name: 'Ville d’Ajaccio', siren: '217200014', type: 'commune',
      },
      errors: [],
    });
  });

  it('le libellé d un type passe par la traduction ; un type inconnu reste tel quel', () => {
    const t = (/** @type {string} */ cle, /** @type {string} */ repli) => `${cle}|${repli}`;
    // eslint-disable-next-line max-len
    expect(collectiviteTypeLabel(t, 'intercommunalite')).toBe('adminCollectivites.types.intercommunalite|Intercommunalité');
    expect(collectiviteTypeLabel(t, 'autre')).toBe('autre');
  });
});
