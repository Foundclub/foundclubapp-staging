import renderer, { act } from 'react-test-renderer';

import ComplexeMaPage from '@/views/complexe/ComplexeMaPage';

import { RouteNames } from '@/navigation/routeNames';

import { dessins, enUnMot, pressable } from '@/testSupport/temoinComplexe';

// L'interrupteur des écrans du JOUEUR allumé : « Voir ma page » n'existe que s'il l'est (la page
// publique du complexe, E-P02, est derrière COMPLEXES_JOUEUR).
jest.mock('@/config/fonctionsMasquees', () => ({
  ...jest.requireActual('@/config/fonctionsMasquees'),
  COMPLEXES_JOUEUR: true,
}));

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
  return function FausseSaisie(/** @type {any} */ {
    label, onChangeText, placeholder, value,
  }) {
    return (
      <Saisie
        accessibilityLabel={label}
        onChangeText={onChangeText}
        placeholder={placeholder}
        value={value}
      />
    );
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

// RESA-FIN-APP (20/10/2026) — E-G11 « Mon complexe », ce que les tournées de recette 1 et 2 ont vu :
//   · « Voir ma » au lieu de « Voir ma page » (Android 16 : un texte gras de plusieurs mots, dans une
//     boîte qui épouse sa largeur, perd son dernier mot) ⇒ dessiné en un seul mot ;
//   · « Voir ma page » ouvrait la page SANS le bandeau « Aperçu : c'est ce que voient les joueurs. »
//     (plan E-G11 :809-810 ; E-P02 le sait déjà, `params.apercu`) ⇒ la page s'ouvre en aperçu ;
//   · l'exemple du lien d'un partenaire était une vraie marque (« https://www.nike.com ») ⇒ un
//     exemple neutre (tranché : jamais une vraie marque).
describe('RESA-FIN-APP E-G11 — « Voir ma page », l’aperçu, l’exemple du lien', () => {
  it('(1) « Voir ma page » est dessiné en un seul mot', async () => {
    const arbre = await monter();
    expect(dessins(arbre, 'Voir ma page')).toEqual([enUnMot('Voir ma page')]);
  });

  it('(4) « Voir ma page » ouvre la page du complexe EN APERÇU', async () => {
    const arbre = await monter();
    await appuyer(arbre, 'Voir ma page');
    expect(mockNavigate).toHaveBeenCalledWith(RouteNames.ReserverComplexe, {
      apercu: true, slug: 'le-five',
    });
  });

  it('(3) l’exemple du lien d’un partenaire n’est pas une vraie marque', async () => {
    const arbre = await monter();
    await appuyer(arbre, 'Ajouter un partenaire');
    const lien = champ(arbre, 'Lien vers le site du partenaire (facultatif)');
    expect(lien).toBeDefined();
    expect(String(lien.props.placeholder || '')).not.toMatch(/nike|adidas|puma|decathlon/i);
    expect(String(lien.props.placeholder || '')).toMatch(/^https:\/\//);
  });
});
