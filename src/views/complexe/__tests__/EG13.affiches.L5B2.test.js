import { Image, TextInput } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ComplexeAffiches from '@/views/complexe/ComplexeAffiches';

import { RouteNames } from '@/navigation/routeNames';

import { lisibles, parRepere, pressable } from '@/testSupport/temoinComplexe';

// RESA-L5B-2 (20/10/2026) — E-G13 « Les affiches » (planches EG13 et RA7 ; plan :890-932 ; A-G10,
// A-G11, A-G12, A-G30, A-G31, RC-G11) sur le serveur RESA-L4 (`POST /complexes/:id/affiche`) :
// « Ton affiche complexe est prête », le style (Écusson, Famille), l'aperçu, « Le texte » (Neutre /
// Promotion : le prix, le texte, la mention fixe, « Réinitialiser »), la fidélité sur l'affiche
// (allumée d'office avec un programme actif ; sans programme, l'invitation vers « Fidélité »),
// « Partager l'affiche », « Story 9:16 », « Imprimer en A4 ». Complexe suspendu : en pause.

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  useRoute: () => ({ params: { complexeId: 'cx-five' } }),
}));

let mockStatut = 'actif';
let mockProgramme = /** @type {any} */ (null);
jest.mock('@/services/complexe/complexeQueries', () => ({
  useComplexeChoisi: (/** @type {any} */ complexeId) => ({
    complexe: {
      documentId: complexeId, name: 'Le Five de Montrivage', slug: 'le-five', status: mockStatut,
    },
    complexeId,
    mes: { data: [], isLoading: false },
  }),
  useFideliteDuComplexe: () => ({ data: { programme: mockProgramme }, isLoading: false }),
}));

/** @type {any[]} */
const mockApercus = [];
let mockApercu = /** @type {any} */ ({});
const mockPartager = jest.fn();
jest.mock('@/services/complexe/complexeAfficheService', () => ({
  partagerAffiche: (/** @type {any[]} */ ...args) => mockPartager(...args),
  useApercuAffiche: (/** @type {any} */ _id, /** @type {any} */ choix, options = {}) => {
    mockApercus.push({ ...choix, ...options });
    return mockApercu;
  },
}));

jest.mock('@/components/molecules/input/Input', () => {
  const { TextInput: Saisie } = jest.requireActual('react-native');
  return function FausseSaisie(/** @type {any} */ { label, onChangeText, value }) {
    return <Saisie accessibilityLabel={label} onChangeText={onChangeText} value={value} />;
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

const monter = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<ComplexeAffiches />);
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
  mockApercus.length = 0;
  mockStatut = 'actif';
  mockProgramme = {
    active: true, counts: 'participants', reward: '1 partie offerte', threshold: 10,
  };
  mockApercu = { data: 'data:image/png;base64,QUJD', isLoading: false, refetch: jest.fn() };
  mockPartager.mockResolvedValue('blob:affiche');
});

describe('E-G13 — les affiches du complexe', () => {
  it('la planche RA7 : titre, styles, aperçu, les deux textes, la fidélité allumée', async () => {
    const arbre = await monter();
    const vus = lisibles(arbre);
    expect(vus).toContain('Ton affiche complexe est prête');
    expect(vus).toContain('Fais-la voir : chaque scan ouvre ta page.');
    expect(vus).toEqual(expect.arrayContaining([
      'Écusson', 'Famille', 'LE TEXTE', 'Neutre', 'Promotion',
    ]));
    expect(vus).toContain('Scannez et ajoutez le complexe à vos favoris.');
    expect(vus).toContain('Ta fidélité sur l’affiche');
    expect(vus)
      .toContain('Au bout de 10 réservations, 1 partie offerte · réglée dans « Fidélité »');
    const images = arbre.root.findAllByType(Image)
      .map((/** @type {any} */ i) => i.props.source?.uri);
    expect(images).toContain('data:image/png;base64,QUJD');
    // L'aperçu demande le texte neutre, le style Écusson, la fidélité allumée d'office.
    expect(mockApercus.at(-1)).toMatchObject({ fidelite: true, style: 'ecusson', texte: 'neutre' });
  });

  it('« Promotion » : prix, phrase, mention fixe ; « Famille » ; fidélité éteinte', async () => {
    const arbre = await monter();
    await appuyer(arbre, 'Promotion');
    const prix = arbre.root.findAll((/** @type {any} */ n) => (
      n.props?.accessibilityLabel === 'Prix de la place' && n.props?.onChangeText
    ))[0];
    await act(async () => {
      prix.props.onChangeText('5');
    });
    expect(lisibles(arbre)).toContain(
      'Scannez, rejoignez le complexe dans vos favoris et bénéficiez d\'une place '
      + 'de réservation à 5 €',
    );
    expect(lisibles(arbre))
      .toContain('La promotion s’applique sur place. L’app ne l’encaisse pas.');
    await appuyer(arbre, 'Famille');
    await appuyer(arbre, 'Ta fidélité sur l’affiche');
    expect(mockApercus.at(-1)).toMatchObject({
      fidelite: false, prix: '5', style: 'famille', texte: 'promotion',
    });
  });

  it('« Partager l’affiche », « Story 9:16 », « Imprimer en A4 » : ce format', async () => {
    const arbre = await monter();
    await appuyer(arbre, 'Partager l’affiche');
    expect(mockPartager).toHaveBeenLastCalledWith(
      'cx-five',
      expect.objectContaining({ format: 'post', style: 'ecusson', texte: 'neutre' }),
      expect.anything(),
    );
    await appuyer(arbre, 'Story 9:16');
    expect(mockPartager.mock.calls.at(-1)[1]).toMatchObject({ format: 'story' });
    await appuyer(arbre, 'Imprimer en A4');
    expect(mockPartager.mock.calls.at(-1)[1]).toMatchObject({ format: 'a4' });
  });

  it('sans programme : l’invitation vers « Fidélité » (E-G14), pas d’interrupteur', async () => {
    mockProgramme = null;
    const arbre = await monter();
    expect(lisibles(arbre)).not.toContain('Ta fidélité sur l’affiche');
    await appuyer(arbre, 'Crée ton programme de fidélité');
    expect(mockNavigate)
      .toHaveBeenCalledWith(RouteNames.ComplexeFidelite, { complexeId: 'cx-five' });
  });

  it('génération : le squelette ; erreur : le message et « Réessayer »', async () => {
    mockApercu = { data: undefined, isLoading: true };
    let arbre = await monter();
    expect(parRepere(arbre, 'affiche-generation')).not.toBeNull();
    mockApercu = {
      data: undefined, error: new Error('render'), isLoading: false, refetch: jest.fn(),
    };
    arbre = await monter();
    expect(lisibles(arbre)).toContain('L’affiche n’a pas pu être créée.');
    await appuyer(arbre, 'Réessayer');
    expect(mockApercu.refetch).toHaveBeenCalled();
  });

  it('complexe suspendu : les affiches sont en pause, aucun aperçu demandé', async () => {
    mockStatut = 'suspendu';
    const arbre = await monter();
    expect(lisibles(arbre)).toContain('Ton complexe est suspendu : ses affiches sont en pause.');
    expect(mockApercus.at(-1)).toMatchObject({ enabled: false });
    expect(arbre.root.findAllByType(TextInput)).toHaveLength(0);
  });
});

// RESA-FIN-APP (20/10/2026) — tournée 2, E-G13 : « Partager » et « Imprimer en A4 » fabriquaient bien l'affiche,
// rangée dans les Photos / Téléchargements du téléphone (Android l'enregistre puis propose « ouvrir avec »),
// mais RIEN ne disait où elle était partie : un fichier rangé sans un mot est indiscernable d'un échec. L'écran
// le dit, comme l'affiche d'un événement (`EventPublishedShowcase`, mêmes phrases). Et (reste de RESA-L5B-2)
// le partage porte un TEXTE : le nom du complexe et le lien de sa page (celui du QR, `?depuis=affiche`) — sur
// Android il part dans le presse-papiers, et l'écran le dit aussi.
describe('RESA-FIN-APP (2) (4) E-G13 — où est l’affiche, et le texte du partage', () => {
  it('Partager (Android) : « C’est enregistré dans ta galerie photo. Le texte est copié… »', async () => {
    mockPartager.mockResolvedValue({ messageCopied: true, opened: false, outcome: 'gallery' });
    const arbre = await monter();
    await appuyer(arbre, 'Partager l’affiche');
    expect(lisibles(arbre)).toContain(
      'C’est enregistré dans ta galerie photo. Le texte est copié : colle-le avec l’image.',
    );
  });

  it('Imprimer en A4 (Android) : « C’est enregistré dans tes téléchargements. »', async () => {
    mockPartager.mockResolvedValue({ messageCopied: false, opened: true, outcome: 'downloads' });
    const arbre = await monter();
    await appuyer(arbre, 'Imprimer en A4');
    expect(lisibles(arbre)).toContain('C’est enregistré dans tes téléchargements.');
  });

  it('feuille de partage (iPhone) ou téléchargement (site) : pas un mot de plus', async () => {
    mockPartager.mockResolvedValue({ outcome: 'shared' });
    const arbre = await monter();
    await appuyer(arbre, 'Partager l’affiche');
    expect(lisibles(arbre).some((texte) => texte.startsWith('C’est enregistré'))).toBe(false);
  });

  it('le texte du partage nomme le complexe et porte le lien de sa page', async () => {
    const arbre = await monter();
    await appuyer(arbre, 'Partager l’affiche');
    const { message } = mockPartager.mock.calls.at(-1)[2];
    expect(message).toContain('Le Five de Montrivage');
    expect(message).toMatch(/\/annuaire\/complexes\/le-five\?depuis=affiche$/);
  });
});
