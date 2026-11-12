/* eslint-disable max-len */
import renderer, { act } from 'react-test-renderer';

import ComplexeFidelite from '@/views/complexe/ComplexeFidelite';

import {
  lisibles,
  parRepere,
  pressable,
} from '@/testSupport/temoinComplexe';

// FIDELITE (12/11/2026, D63, maquette « 237- ok ») — E-G14 : le TYPE de récompense (partie
// offerte, réduction en %, récompense libre) et ses réglages (parties offertes, %, sur n parties,
// la part du joueur ou le terrain entier) ; « Enregistrer » envoie le type ; « Statistiques
// fidélité » : par mois et par client (`GET /complexes/:id/fidelite/statistiques`).

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
  useStatistiquesFidelite: () => mockStats,
  useValiderRecompense: () => ({ isPending: false, mutateAsync: mockValider }),
}));
let mockStats = /** @type {any} */ ({});

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

const parRepereTouche = async (/** @type {any} */ arbre, /** @type {string} */ repere) => {
  await act(async () => {
    parRepere(arbre, repere).props.onPress();
  });
};

describe('FIDELITE — E-G14, les trois types', () => {
  it('« Partie offerte » : 2 parties, le terrain entier ; « Enregistrer » envoie le type, sans texte', async () => {
    const arbre = await monter();
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'Type de récompense', 'Partie offerte', 'Réduction en %', 'Récompense libre', 'automatique', 'remise sur place',
    ]));
    await parRepereTouche(arbre, 'fidelite-type-partie');
    expect(parRepere(arbre, 'fidelite-reglage-auto')).toBeTruthy();
    await appuyer(arbre, 'Une partie de plus');
    await parRepereTouche(arbre, 'fidelite-part-terrain');
    expect(lisibles(arbre)).toContain('Encore 2 réservations avant ta partie offerte');
    await appuyer(arbre, 'Enregistrer');
    expect(mockRegler).toHaveBeenCalledWith({
      complexeId: 'cx-five',
      programme: {
        active: true, counts: 'participants', rewardType: 'partie', rewardUses: 2, scope: 'terrain', threshold: 10,
      },
    });
  });

  it('« Réduction en % » : 15 % sur 1 partie, la part du joueur', async () => {
    const arbre = await monter();
    await parRepereTouche(arbre, 'fidelite-type-remise');
    await appuyer(arbre, '5 % de plus');
    expect(lisibles(arbre)).toContain('Encore 2 réservations avant 15 % de réduction');
    await appuyer(arbre, 'Enregistrer');
    expect(mockRegler.mock.calls[0][0].programme).toEqual({
      active: true, counts: 'participants', percent: 15, rewardType: 'remise', rewardUses: 1, scope: 'joueur', threshold: 10,
    });
  });

  it('un programme enregistré automatique se relit : le type choisi, sans champ « Récompense »', async () => {
    mockLecture = lecture();
    mockLecture.data.programme = {
      active: true, counts: 'reserveur', percent: 20, reward: null, rewardType: 'remise', rewardUses: 1, scope: 'terrain', threshold: 5,
    };
    const arbre = await monter();
    expect(parRepere(arbre, 'fidelite-type-remise').props.accessibilityState).toEqual({ checked: true });
    expect(parRepere(arbre, 'fidelite-part-terrain').props.accessibilityState).toEqual({ checked: true });
    expect(lisibles(arbre)).not.toContain('Récompense');
  });

  it('« Statistiques fidélité » : par mois (le mois en cours) puis par client', async () => {
    mockStats = {
      data: {
        clients: [{
          debloques: 2, documentId: 'u-julien', montant: 30, nom: 'Julien M.', parties: 23, utilises: 2,
        }],
        mois: [
          {
            debloques: 3, mois: '2026-10', montant: 0, utilises: 1,
          },
          {
            debloques: 14, mois: '2026-11', montant: 162, utilises: 9,
          },
        ],
      },
      isLoading: false,
    };
    const arbre = await monter();
    expect(parRepere(arbre, 'fidelite-statistiques')).toBeNull();
    await appuyer(arbre, 'Statistiques fidélité');
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'Par mois', 'Par client', '14', 'bonus débloqués', '9', 'bonus utilisés', '162 €', 'offerts ou remisés', '6 DERNIERS MOIS',
    ]));
    await parRepereTouche(arbre, 'fidelite-stats-clients');
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'CLIENTS LES PLUS FIDÈLES', 'Julien M.', '23 parties · bonus débloqués : 2, utilisés : 2', '30 €',
    ]));
  });
});
