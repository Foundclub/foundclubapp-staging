import renderer, { act } from 'react-test-renderer';

import ComplexeFidelite from '@/views/complexe/ComplexeFidelite';

import { RouteNames } from '@/navigation/routeNames';

import {
  lisibles,
  parRepere,
  pressable,
} from '@/testSupport/temoinComplexe';

// RESA-L5B-2 (20/10/2026) — E-G14 « Fidélité » (planche EG14 états 1 à 5 ; plan :933-969 ;
// RG-FIDELITE, Q2, RC-G10, RC-G11) : « TON PROGRAMME » (active, au bout de x, la récompense, qui
// compte, le texte fixe), « CE QUE VOIT LE JOUEUR », « RÉCOMPENSES À VALIDER » (« Valider » et sa
// confirmation), « BIENTÔT », « DERNIÈRES VALIDÉES », « Enregistrer ». Jamais réglé :
// « Récompense tes habitués. » et « Créer mon programme ». Doublures :
// `GET|PUT /complexes/:id/fidelite`, `POST /complexes/:id/fidelite/:joueurId/valider` (RESA-L4).

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  useRoute: () => ({ params: { complexeId: 'cx-five' } }),
}));

let mockLecture = /** @type {any} */ ({});
const mockRegler = jest.fn();
const mockValider = jest.fn();
jest.mock('@/services/complexe/complexeQueries', () => ({
  useComplexeChoisi: jest.requireActual('@/testSupport/temoinComplexe').complexeChoisiDeTemoin,
  useFideliteDuComplexe: () => mockLecture,
  useReglerFidelite: () => ({ isPending: false, mutateAsync: mockRegler }),
  useValiderRecompense: () => ({ isPending: false, mutateAsync: mockValider }),
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

const PROGRAMME = {
  active: true, counts: 'participants', reward: '1 partie offerte', threshold: 10,
};

/**
 * La lecture du gérant (`lireGerant`, RESA-L4).
 * @param {Record<string, any>} [autres] - Ce qui change.
 * @returns {any} La lecture.
 */
const lecture = (autres = {}) => ({
  data: {
    aValider: [{
      count: 10,
      joueur: { documentId: 'u-julien', firstname: 'Julien', lastname: 'Marchal' },
      reachedAt: '2026-10-19T08:00:00.000Z',
      threshold: 10,
    }],
    bientot: [{
      count: 8,
      joueur: { documentId: 'u-karim', firstname: 'Karim', lastname: 'Benali' },
      reachedAt: null,
      threshold: 10,
    }],
    dernieresValidees: [{
      joueur: { documentId: 'u-mathis', firstname: 'Mathis', lastname: 'Renaud' },
      parMoi: true,
      reward: '1 partie offerte',
      threshold: 10,
      validatedAt: '2026-10-02T15:00:00.000Z',
      validePar: 'Sofia L.',
    }],
    programme: PROGRAMME,
  },
  isLoading: false,
  refetch: jest.fn(),
  ...autres,
});

const monter = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<ComplexeFidelite />);
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
  mockLecture = lecture();
});

describe('E-G14 — la fidélité du complexe', () => {
  it('les 5 blocs de la planche (état 1), dans l’ordre', async () => {
    const arbre = await monter();
    const vus = lisibles(arbre);
    const rang = (/** @type {string} */ texte) => vus.indexOf(texte);
    expect(rang('FIDÉLITÉ')).toBeGreaterThan(-1);
    expect(rang('TON PROGRAMME')).toBeLessThan(rang('CE QUE VOIT LE JOUEUR'));
    expect(rang('CE QUE VOIT LE JOUEUR')).toBeLessThan(rang('RÉCOMPENSES À VALIDER'));
    expect(rang('RÉCOMPENSES À VALIDER')).toBeLessThan(rang('BIENTÔT'));
    expect(rang('BIENTÔT')).toBeLessThan(rang('DERNIÈRES VALIDÉES'));
    expect(vus).toContain('Fidélité active');
    expect(vus).toContain('Qui compte ?');
    expect(vus).toContain('Le réserveur seulement');
    expect(vus).toContain('Le réserveur et les participants présents');
    expect(vus).toContain(
      'Seules les réservations jouées comptent (pas les annulées ni les non honorées).',
    );
    expect(vus).toContain('Encore 2 réservations avant « 1 partie offerte »');
    expect(vus).toContain('Julien M.');
    expect(vus).toContain('10/10 · récompense disponible');
    expect(vus).toContain('Karim B.');
    expect(vus).toContain('8/10');
    expect(vus).toContain('Mathis R. · validée le 02/10 par toi');
    expect(vus).toContain('16 / 40');
  });

  it('« Enregistrer » envoie la liste blanche et dit « Programme enregistré. »', async () => {
    mockRegler.mockResolvedValue({ data: { programme: PROGRAMME } });
    const arbre = await monter();
    await appuyer(arbre, 'Le réserveur seulement');
    expect(lisibles(arbre)).toContain('Les compteurs déjà commencés sont gardés.');
    await appuyer(arbre, 'Enregistrer');
    expect(mockRegler).toHaveBeenCalledWith({
      complexeId: 'cx-five',
      programme: {
        active: true, counts: 'reserveur', reward: '1 partie offerte', threshold: 10,
      },
    });
    expect(lisibles(arbre)).toContain('Programme enregistré.');
  });

  it('couper la fidélité : « Les compteurs sont gardés si tu la rallumes. »', async () => {
    const arbre = await monter();
    await appuyer(arbre, 'Fidélité active');
    expect(lisibles(arbre)).toContain('Les compteurs sont gardés si tu la rallumes.');
  });

  it('« Valider » : la confirmation, puis le geste, puis « Validée »', async () => {
    mockValider.mockResolvedValue({ data: { count: 0 } });
    const arbre = await monter();
    await act(async () => {
      parRepere(arbre, 'fidelite-valider-u-julien')
        .findAll((/** @type {any} */ n) => typeof n.props?.onPress === 'function')[0]
        .props.onPress();
    });
    const vus = lisibles(arbre);
    expect(vus).toContain('Valider la partie offerte de Julien M. ?');
    expect(vus).toContain('Son compteur repart à 0.');
    await act(async () => {
      parRepere(arbre, 'fidelite-confirmer')
        .findAll((/** @type {any} */ n) => typeof n.props?.onPress === 'function')[0]
        .props.onPress();
    });
    expect(mockValider).toHaveBeenCalledWith({ complexeId: 'cx-five', joueurId: 'u-julien' });
    expect(lisibles(arbre)).toContain('Julien M. : validée.');
  });

  it('un client « Bientôt » ouvre sa fiche (E-G15)', async () => {
    const arbre = await monter();
    await appuyer(arbre, 'Karim B.');
    expect(mockNavigate).toHaveBeenCalledWith(RouteNames.ComplexeClient, {
      complexeId: 'cx-five', joueurId: 'u-karim',
    });
  });

  it('jamais réglé : « Récompense tes habitués. », puis « Créer mon programme »', async () => {
    mockLecture = lecture({
      data: {
        aValider: [], bientot: [], dernieresValidees: [], programme: null,
      },
    });
    const arbre = await monter();
    expect(lisibles(arbre)).toContain('Récompense tes habitués.');
    expect(lisibles(arbre)).not.toContain('TON PROGRAMME');
    await appuyer(arbre, 'Créer mon programme');
    expect(lisibles(arbre)).toContain('TON PROGRAMME');
  });

  it('aucun client proche : la phrase de la planche (état 5)', async () => {
    mockLecture = lecture({
      data: {
        aValider: [], bientot: [], dernieresValidees: [], programme: PROGRAMME,
      },
    });
    const arbre = await monter();
    expect(lisibles(arbre)).toContain('Aucun client n’approche encore de sa récompense.');
  });

  it('chargement : le squelette ; erreur : « Impossible de charger les clients. »', async () => {
    mockLecture = { data: undefined, isLoading: true };
    let arbre = await monter();
    expect(parRepere(arbre, 'fidelite-squelette')).not.toBeNull();
    mockLecture = {
      data: undefined, error: new Error('panne'), isLoading: false, refetch: jest.fn(),
    };
    arbre = await monter();
    expect(lisibles(arbre)).toContain('Impossible de charger les clients.');
    await appuyer(arbre, 'Réessayer');
    expect(mockLecture.refetch).toHaveBeenCalled();
  });
});
