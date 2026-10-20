import renderer, { act } from 'react-test-renderer';

import ComplexeMaPage from '@/views/complexe/ComplexeMaPage';

import { RouteNames } from '@/navigation/routeNames';

import { lisibles, parRepere, pressable } from '@/testSupport/temoinComplexe';

// RESA-L5B-2 (20/10/2026) — E-G11 « Mon complexe » (planches EG11 états 1 à 4 et RA5 ; plan
// :802-845 ; A-G04, A-G05, A-G25, RG-TEL) : « Identité » (logo, nom, photos de couverture,
// description), « Nos partenaires » (RA5 : ajouter, supprimer, les textes des clubs),
// « Coordonnées », « Horaires d'accueil », « Sports » (déduits des terrains), « Ce que la page
// affiche » (vers Réglages), les pastilles, « Enregistrer » (« Ta page est à jour. »). Doublures :
// `GET|PUT /complexes/:id/manage` (RESA-L1A), `GET|PUT /complexes/:id/partenaires` (RESA-L4).

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  useRoute: () => ({ params: { complexeId: 'cx-five' } }),
}));

let mockComplexe = /** @type {any} */ ({});
let mockPartenaires = /** @type {any[]} */ ([]);
const mockModifier = jest.fn();
const mockEnregistrerPartenaires = jest.fn();
jest.mock('@/services/complexe/complexeQueries', () => ({
  useComplexeChoisi: jest.requireActual('@/testSupport/temoinComplexe').complexeChoisiDeTemoin,
  useComplexeGere: () => ({ data: mockComplexe, isLoading: false, refetch: jest.fn() }),
  useEnregistrerPartenaires: () => ({ isPending: false, mutateAsync: mockEnregistrerPartenaires }),
  useModifierComplexe: () => ({ isPending: false, mutateAsync: mockModifier }),
  usePartenairesDuComplexe: () => ({ data: mockPartenaires, isLoading: false }),
}));
const mockTeleverser = jest.fn();
jest.mock('@/services/complexe/complexeService', () => ({
  televerserPhoto: (/** @type {any} */ fichier) => mockTeleverser(fichier),
}));
jest.mock('@/platform/media', () => ({
  __esModule: true,
  default: { pickImage: async () => ({ assets: [{ fileSize: 1000, uri: 'file://logo.png' }] }) },
}));

jest.mock('@/components/molecules/bottomModal/BottomModal', () => (
  function FausseFeuille(/** @type {any} */ { children, isVisible }) {
    return isVisible ? children : null;
  }
));
jest.mock('@/components/molecules/input/Input', () => {
  const { TextInput: Saisie } = jest.requireActual('react-native');
  return function FausseSaisie(/** @type {any} */ { label, onChangeText, value }) {
    return <Saisie accessibilityLabel={label} onChangeText={onChangeText} value={value} />;
  };
});
jest.mock('@/components/organisms/phoneInput/PhoneInput', () => {
  const { TextInput: Saisie } = jest.requireActual('react-native');
  return function FauxTelephone(/** @type {any} */ { label, onChange, value }) {
    return <Saisie accessibilityLabel={label} onChangeText={onChange} value={value} />;
  };
});
jest.mock('@/components/organisms/autocompleteAddressInput/autocompleteAddressInput', () => {
  const { Text: Texte } = jest.requireActual('react-native');
  return function FausseAdresse(/** @type {any} */ { address, label }) {
    return <Texte>{`${label} : ${address?.label || ''}`}</Texte>;
  };
});
jest.mock('@/components/templates/ScreenContainer', () => (
  function FauxConteneur(/** @type {any} */ { children }) {
    return children;
  }
));
jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));
jest.mock('@/theme/themeContext', () => (
  jest.requireActual('@/testSupport/temoinComplexe').themeDeTemoin()
));

const COMPLEXE = {
  address: { label: '12 allée des Sports, Montrivage', lat: 45.1, lng: 4.8 },
  description: 'Deux terrains de foot à 5.',
  documentId: 'cx-five',
  email: 'accueil@lefive.example',
  logo: { id: 7, url: '/logo.png' },
  name: 'Le Five de Montrivage',
  openingHours: [{ day: 1, ranges: [{ from: '17:00', to: '23:00' }] }],
  phoneNumber: '+33639981234',
  photos: [{ id: 3, url: '/p.png' }],
  rules: { cancellationDelayHours: 24, minAge: 16 },
  siret: null,
  slug: 'le-five',
  sports: [
    { documentId: 'a-five', name: 'Football à 5' },
    { documentId: 'a-padel', name: 'Padel' },
  ],
  status: 'actif',
  verified: false,
  websiteUrl: null,
};

const champ = (/** @type {any} */ arbre, /** @type {string} */ libelle) => arbre.root.findAll(
  (/** @type {any} */ n) => n.props?.accessibilityLabel === libelle && n.props?.onChangeText,
)[0];

const monter = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<ComplexeMaPage />);
  });
  return arbre;
};

const appuyer = async (/** @type {any} */ arbre, /** @type {string} */ libelle) => {
  await act(async () => {
    pressable(arbre, libelle).props.onPress();
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockComplexe = { ...COMPLEXE };
  mockPartenaires = [
    {
      documentId: 'p-1', link: null, logo: { id: 9, url: '/s.png' }, title: 'Sport Montrivage',
    },
  ];
  mockModifier.mockResolvedValue({ data: COMPLEXE });
  mockEnregistrerPartenaires.mockResolvedValue({ data: { items: [] } });
  mockTeleverser.mockResolvedValue({ id: 42, url: '/neuf.png' });
});

describe('E-G11 — Mon complexe (la page)', () => {
  it('les blocs de la planche, dans l’ordre (EG11 état 1, RA5 état 1)', async () => {
    const arbre = await monter();
    const vus = lisibles(arbre);
    const rang = (/** @type {string} */ texte) => vus.indexOf(texte);
    const blocs = [
      'IDENTITÉ', 'NOS PARTENAIRES', 'COORDONNÉES', 'HORAIRES D’ACCUEIL', 'SPORTS',
      'CE QUE LA PAGE AFFICHE',
    ];
    blocs.forEach((bloc) => expect(rang(bloc)).toBeGreaterThan(-1));
    blocs.slice(1).forEach((bloc, i) => expect(rang(bloc)).toBeGreaterThan(rang(blocs[i])));
    expect(vus).toContain('Sport Montrivage');
    expect(vus).toContain('Football à 5');
    expect(vus)
      .toContain('Ils viennent de tes terrains : ajoute un terrain pour ajouter un sport.');
    expect(vus)
      .toContain('Réservation à partir de 16 ans · Annulation gratuite jusqu’à 24 h avant');
    expect(vus).toContain('« Vérifié » s’ajoutera quand FoundClub l’aura vérifié.');
    expect(vus).toContain('Lundi');
    expect(vus).toContain('Adresse : 12 allée des Sports, Montrivage');
  });

  it('« Enregistrer » : seuls les champs changés, puis « Ta page est à jour. »', async () => {
    const arbre = await monter();
    await act(async () => {
      champ(arbre, 'Description').props.onChangeText('Trois terrains.');
    });
    await appuyer(arbre, 'Enregistrer');
    expect(mockModifier).toHaveBeenCalledWith({
      complexeId: 'cx-five', donnees: { description: 'Trois terrains.' },
    });
    expect(lisibles(arbre)).toContain('Ta page est à jour.');
  });

  it('les champs obligatoires manquants arrêtent l’enregistrement (EG11 état 2)', async () => {
    const arbre = await monter();
    await act(async () => {
      champ(arbre, 'Nom').props.onChangeText('  ');
      champ(arbre, 'Téléphone affiché').props.onChangeText('');
    });
    await appuyer(arbre, 'Enregistrer');
    expect(mockModifier).not.toHaveBeenCalled();
    const vus = lisibles(arbre);
    expect(vus).toContain('Le nom est obligatoire.');
    expect(vus).toContain('Le téléphone est obligatoire.');
  });

  it('« Changer le logo » : la photo part, le logo neuf est enregistré', async () => {
    const arbre = await monter();
    await appuyer(arbre, 'Changer le logo');
    await appuyer(arbre, 'Enregistrer');
    expect(mockModifier).toHaveBeenCalledWith({ complexeId: 'cx-five', donnees: { logo: 42 } });
  });

  it('retirer une photo demande confirmation (EG11 état 3)', async () => {
    const arbre = await monter();
    await act(async () => {
      parRepere(arbre, 'page-photo-retirer-3').props.onPress();
    });
    expect(lisibles(arbre)).toContain('Retirer cette photo ?');
    expect(lisibles(arbre)).toContain('Elle disparaît de ta page publique.');
    await act(async () => {
      parRepere(arbre, 'page-photo-confirmer')
        .findAll((/** @type {any} */ n) => typeof n.props?.onPress === 'function')[0]
        .props.onPress();
    });
    await appuyer(arbre, 'Enregistrer');
    expect(mockModifier).toHaveBeenCalledWith({ complexeId: 'cx-five', donnees: { photos: [] } });
  });

  it('ajouter un partenaire (RA5 état 3) : le logo, le nom, la liste ENTIÈRE part', async () => {
    const arbre = await monter();
    await appuyer(arbre, 'Ajouter un partenaire');
    expect(lisibles(arbre))
      .toContain('Il apparaîtra sur ta page et sur ta carte dans la recherche.');
    const ajouter = parRepere(arbre, 'partenaire-ajouter')
      .findAll((/** @type {any} */ n) => (
        'disabled' in n.props && typeof n.props.onPress === 'function'
      ))[0];
    expect(ajouter.props.disabled).toBe(true);
    await appuyer(arbre, 'Logo du partenaire');
    await act(async () => {
      champ(arbre, 'Nom du partenaire').props.onChangeText('Boulangerie Roux');
    });
    await act(async () => {
      parRepere(arbre, 'partenaire-ajouter')
        .findAll((/** @type {any} */ n) => typeof n.props?.onPress === 'function')[0]
        .props.onPress();
    });
    expect(mockEnregistrerPartenaires).toHaveBeenCalledWith({
      complexeId: 'cx-five',
      partenaires: [
        { documentId: 'p-1', logo: 9, title: 'Sport Montrivage' },
        { logo: 42, title: 'Boulangerie Roux' },
      ],
    });
  });

  it('supprimer un partenaire : les textes des clubs, puis la liste sans lui', async () => {
    const arbre = await monter();
    await act(async () => {
      parRepere(arbre, 'partenaire-retirer-p-1').props.onPress();
    });
    const vus = lisibles(arbre);
    expect(vus).toContain('Tu es sur le point de supprimer le partenaire Sport Montrivage.');
    expect(vus).toContain('Es-tu sûr·e de vouloir continuer ?');
    await act(async () => {
      parRepere(arbre, 'partenaire-supprimer')
        .findAll((/** @type {any} */ n) => typeof n.props?.onPress === 'function')[0]
        .props.onPress();
    });
    expect(mockEnregistrerPartenaires)
      .toHaveBeenCalledWith({ complexeId: 'cx-five', partenaires: [] });
  });

  it('suspendu : « Ta page est masquée… » ; « Changer dans Réglages » ouvre E-G16', async () => {
    mockComplexe = { ...COMPLEXE, status: 'suspendu' };
    const arbre = await monter();
    expect(lisibles(arbre)).toContain('Ta page est masquée : complexe suspendu.');
    await appuyer(arbre, 'Changer dans Réglages');
    expect(mockNavigate)
      .toHaveBeenCalledWith(RouteNames.ComplexeReglages, { complexeId: 'cx-five' });
  });
});
