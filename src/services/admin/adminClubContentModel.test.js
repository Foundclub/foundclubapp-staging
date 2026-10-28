import {
  buildAddressFromForm,
  buildClubFormInitialValues,
  CLUB_DETAIL_POPULATE,
  getClubCity,
  getClubInitials,
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

// BH14 (BUGHUNT 24/10/2026) — P2-12, P2-15, P9-18.
describe('BH14 — ville, code postal et coordonnées du club', () => {
  const ancien = JSON.stringify({
    city: 'Lyon', lat: 45.7, lng: 4.8, postcode: '69001',
  });

  it('P2-12 : un club sans ville ne prend pas son code postal pour ville', () => {
    expect(getClubCity({ address: { postcode: '69001' } })).toBe('');
  });

  it('P2-15 : vider les coordonnées les efface', () => {
    const adresse = buildAddressFromForm({ addressJson: ancien, latitude: '', longitude: '' });
    expect(adresse.lat).toBeNull();
    expect(adresse.lng).toBeNull();
  });

  it('P9-18 : vider la ville et le code postal les efface', () => {
    const adresse = buildAddressFromForm({ addressJson: ancien, city: '', postcode: '' });
    expect(adresse.city).toBe('');
    expect(adresse.postcode).toBe('');
  });

  it('caractérisé : sans champ du formulaire, l adresse avancée est gardée', () => {
    const adresse = buildAddressFromForm({ addressJson: ancien });
    expect(adresse).toMatchObject({
      city: 'Lyon', lat: 45.7, lng: 4.8, postcode: '69001',
    });
  });
});

// C10 / Q4-22 (BUGHUNT 25/10, RÉGRESSION de P2-15 / P9-18) — un club sans ville ni coordonnées :
// le SuperAdmin les écrit dans « Adresse JSON avancée », les champs simples restent vides… et
// l'enregistrement les effaçait, puisqu'un champ simple vide « efface ». Le formulaire part ici
// de ses VRAIES valeurs initiales (buildClubFormInitialValues).
describe('C10 · Q4-22 — l adresse JSON avancée saisie à la main n est plus écrasée', () => {
  it('club sans ville : ville et coordonnées écrites dans le JSON avancé sont gardées', () => {
    const formulaire = {
      ...buildClubFormInitialValues({ name: 'AS Test' }),
      addressJson: '{"city":"Lyon","lat":45.76,"lng":4.83,"postcode":"69001"}',
    };
    expect(buildAddressFromForm(formulaire)).toMatchObject({
      city: 'Lyon', lat: 45.76, lng: 4.83, postcode: '69001',
    });
  });

  it('non-régression P9-18 : JSON non modifié, ville vidée dans le champ simple : effacée', () => {
    const formulaire = {
      ...buildClubFormInitialValues({
        address: {
          city: 'Paris', lat: 48.85, lng: 2.35, postcode: '75001',
        },
        name: 'AS Test',
      }),
      city: '',
      latitude: '',
      postcode: '',
    };
    const adresse = buildAddressFromForm(formulaire);
    expect(adresse.city).toBe('');
    expect(adresse.postcode).toBe('');
    expect(adresse.lat).toBeNull();
  });
});

describe('getClubInitials (fiche club du superadmin)', () => {
  it('garde le comportement actuel des autres noms', () => {
    expect(getClubInitials({})).toBe('FC');
    expect(getClubInitials({ name: 'Bordeaux' })).toBe('BO');
    expect(getClubInitials({ name: 'Football Club Paris' })).toBe('FC');
  });

  // PETITSBUGS-2683 : « SCM » s'affichait « SC ».
  it('garde entier un nom qui est deja un sigle court en capitales', () => {
    expect(getClubInitials({ name: 'SCM' })).toBe('SCM');
    expect(getClubInitials({ name: 'ASPTT' })).toBe('AS');
  });
});
