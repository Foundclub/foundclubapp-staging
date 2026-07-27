import {
  buildClubFormInitialValues,
  CLUB_DETAIL_POPULATE,
} from './adminClubContentModel';

// La fiche club du superadmin passe par /superadmin/content/:uid/:documentId, qui
// transmet `populate` DIRECTEMENT au Document Service de Strapi 5. Contrairement a
// l'API REST classique (/clubs/:id), le Document Service n'accepte PAS la notation
// pointee ('sponsor.logo') dans un tableau : il rejetait le tableau ENTIER, donc
// plus aucune relation n'etait peuplee.
// Symptome constate le 2026-07-28 : dans « Modifier le club », le cadre du logo
// reste vide alors que le club a bien un logo.
describe('CLUB_DETAIL_POPULATE', () => {
  it('n\'utilise aucune notation pointee (le Document Service ne la comprend pas)', () => {
    const directKeys = Array.isArray(CLUB_DETAIL_POPULATE)
      ? CLUB_DETAIL_POPULATE
      : Object.keys(typeof CLUB_DETAIL_POPULATE === 'object' && CLUB_DETAIL_POPULATE
        ? CLUB_DETAIL_POPULATE
        : {});

    expect(directKeys.filter((key) => String(key).includes('.'))).toEqual([]);
  });

  it('demande quand meme les relations de premier niveau, logo compris', () => {
    if (CLUB_DETAIL_POPULATE === '*') {
      // '*' couvre toutes les relations de premier niveau : logo, activites,
      // parentMultisport, members, teams, sponsor...
      expect(CLUB_DETAIL_POPULATE).toBe('*');
      return;
    }

    const keys = Array.isArray(CLUB_DETAIL_POPULATE)
      ? CLUB_DETAIL_POPULATE
      : Object.keys(CLUB_DETAIL_POPULATE || {});
    ['logo', 'activites', 'parentMultisport', 'members', 'teams', 'sponsor']
      .forEach((expected) => expect(keys).toContain(expected));
  });
});

describe('buildClubFormInitialValues', () => {
  it('conserve l\'adresse du fichier logo, sinon le cadre reste vide', () => {
    const values = buildClubFormInitialValues({
      documentId: 'club-doc-1',
      logo: { documentId: 'file-doc-1', id: 55, url: 'https://cdn.example/logo.png' },
      name: 'STADE MARSEILLAIS UNIVERSITE',
    });

    expect(values.logo?.url).toBe('https://cdn.example/logo.png');
    expect(values.name).toBe('STADE MARSEILLAIS UNIVERSITE');
  });

  it('deballe la forme Strapi v4 { data: { attributes } } sans perdre l\'url', () => {
    const values = buildClubFormInitialValues({
      documentId: 'club-doc-3',
      logo: { data: { attributes: { url: 'https://cdn.example/v4.png' } } },
      name: 'AS Ancienne Forme',
    });

    expect(values.logo?.url).toBe('https://cdn.example/v4.png');
  });

  it('accepte un club sans logo sans planter', () => {
    const values = buildClubFormInitialValues({ documentId: 'club-doc-2', name: 'AS Sans Logo' });
    expect(values.logo).toBeNull();
  });
});
