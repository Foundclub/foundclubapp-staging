import { TextInput } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ComplexeReglages from '@/views/complexe/ComplexeReglages';

import {
  COMPLEXE_FIVE,
  lisibles,
  parRepere,
  pressable,
} from '@/testSupport/temoinComplexe';

// RESA-L5A1 (13/10/2026) — E-G16 « Les réglages du complexe » (planches EG16 et RA6) : qui peut
// réserver, annuler et réserver, le mot aux joueurs, les collectes, les non honorées, les
// notifications ; « Enregistrer » envoie les règles au serveur (contrat L1, `PUT …/manage`).

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), setOptions: jest.fn() }),
  useRoute: () => ({ params: { complexeId: 'cx-five' } }),
}));

const REGLES = {
  autoBanNoShows: 3,
  cancellationDelayHours: 24,
  collectDeadlineHours: 24,
  dayBeforeConfirmation: true,
  maxUpcomingPerUser: 2,
  minAge: 18,
  minLeadTimeHours: 2,
  morningDigest: true,
};

let mockComplexe = /** @type {any} */ ({});
const mockModifier = jest.fn();
const mockRelire = jest.fn();
// RESA-L5B-1, partie B (B4) — l'aperçu d'un âge minimum relevé (`PUT …/manage`, `dryRun`).
let mockApercuAge = /** @type {any} */ ({ data: undefined });
/** @type {any[]} */
const mockApercusAge = [];
jest.mock('@/services/complexe/complexeQueries', () => ({
  useApercuAgeMinimum: (/** @type {any[]} */ ...args) => {
    mockApercusAge.push(args);
    return mockApercuAge;
  },
  useComplexeChoisi: jest.requireActual('@/testSupport/temoinComplexe').complexeChoisiDeTemoin,
  useComplexeGere: () => mockComplexe,
  useModifierComplexe: () => ({ isPending: false, mutateAsync: mockModifier }),
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

/**
 * Monte l'écran.
 * @returns {Promise<any>} L'arbre.
 */
const monter = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<ComplexeReglages />);
  });
  return arbre;
};

/**
 * Appuie sur un élément par son libellé.
 * @param {any} arbre - L'arbre.
 * @param {string} libelle - Le libellé.
 * @returns {Promise<void>} Fini.
 */
const appuyer = async (arbre, libelle) => {
  await act(async () => {
    await pressable(arbre, libelle).props.onPress();
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockComplexe = {
    data: { ...COMPLEXE_FIVE, playersNote: null, rules: { ...REGLES } },
    isLoading: false,
    refetch: mockRelire,
  };
  mockModifier.mockResolvedValue({ data: {} });
});

describe('RESA-L5A1 E-G16 — les réglages (état 1, RA6 état 1)', () => {
  it('les blocs de la planche, avec les règles du serveur', async () => {
    const arbre = await monter();
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'Réglages',
      'Le Five de Montrivage',
      'QUI PEUT RÉSERVER',
      'Âge minimum',
      // eslint-disable-next-line max-len
      'Un joueur plus jeune ne peut ni réserver, ni rejoindre une partie, ni recevoir tes annonces. Un joueur qui a cet âge peut t’écrire dans sa réservation.',
      'ANNULER ET RÉSERVER',
      'Annulation gratuite jusqu’à',
      'Réserver au plus tard',
      '2 h avant le créneau',
      'Réservations à venir par personne',
      'Les demandes et les collectes en cours comptent.',
      'TON MESSAGE AUX JOUEURS',
      'COLLECTES',
      'Date limite de collecte au plus tard',
      '24 h avant le créneau',
      'NON HONORÉES',
      'Bannir automatiquement après',
      '3 réservations non honorées',
      'Le bannissement ne vaut que chez toi. Tu peux le lever à tout moment.',
      'NOTIFICATIONS',
      'Résumé du matin à 8 h',
      'Demander aux joueurs de confirmer la veille',
    ]));
    expect(parRepere(arbre, 'complexe-reglages-resume-matin')?.props.accessibilityState)
      .toEqual({ checked: true });
  });

  it('changer, puis « Enregistrer » : les règles et le mot aux joueurs partent', async () => {
    const arbre = await monter();
    await appuyer(arbre, '16 ans');
    await appuyer(arbre, '48 h');
    await appuyer(arbre, 'Moins : Bannir automatiquement après');
    await appuyer(arbre, 'Moins : Bannir automatiquement après');
    await appuyer(arbre, 'Moins : Bannir automatiquement après');
    expect(lisibles(arbre)).toContain('Jamais');
    await appuyer(arbre, 'Plus : Réservations à venir par personne');
    await appuyer(arbre, 'Demander aux joueurs de confirmer la veille');
    const [mot] = arbre.root.findAll((n) => n.type === TextInput
      && n.props.accessibilityLabel === 'Ce que les joueurs doivent savoir (facultatif)');
    await act(async () => {
      mot.props.onChangeText('Arrive 10 minutes avant ton créneau.');
    });
    expect(lisibles(arbre)).toContain('36 / 500');
    await appuyer(arbre, 'Enregistrer');
    expect(mockModifier).toHaveBeenCalledWith({
      complexeId: 'cx-five',
      donnees: {
        autoBanNoShows: 0,
        cancellationDelayHours: 48,
        collectDeadlineHours: 24,
        dayBeforeConfirmation: false,
        maxUpcomingPerUser: 3,
        minAge: 16,
        minLeadTimeHours: 2,
        morningDigest: true,
        playersNote: 'Arrive 10 minutes avant ton créneau.',
      },
    });
    expect(lisibles(arbre))
      .toContain('Réglages enregistrés. Ils valent pour les prochaines réservations.');
  });

  it('les compteurs restent dans les bornes du serveur', async () => {
    const arbre = await monter();
    for (let fois = 0; fois < 30; fois += 1) {
      // eslint-disable-next-line no-await-in-loop
      await appuyer(arbre, 'Plus : Réserver au plus tard');
    }
    expect(parRepere(arbre, 'complexe-reglages-valeur-minLeadTimeHours')?.props.children)
      .toBe('24 h avant le créneau');
    for (let fois = 0; fois < 30; fois += 1) {
      // eslint-disable-next-line no-await-in-loop
      await appuyer(arbre, 'Moins : Date limite de collecte au plus tard');
    }
    expect(parRepere(arbre, 'complexe-reglages-valeur-collectDeadlineHours')?.props.children)
      .toBe('2 h avant le créneau');
  });
});

describe('RESA-L5B-1 B4 E-G16 — relever l’âge minimum (serveur RESA-L2C)', () => {
  beforeEach(() => {
    mockApercusAge.length = 0;
    mockApercuAge = { data: undefined };
  });

  it('relevé : l’aperçu est lu pour le nouvel âge, et « Elles sont gardées. »', async () => {
    mockComplexe.data.rules.minAge = 16;
    mockApercuAge = { data: { dryRun: true, minAge: 18, reservationsPlusJeunes: 2 } };
    const arbre = await monter();
    await appuyer(arbre, '18 ans');
    expect(mockApercusAge[mockApercusAge.length - 1]).toEqual(['cx-five', 18, { enabled: true }]);
    expect(lisibles(arbre)).toContain(
      '2 réservations à venir comptent des joueurs de moins de 18 ans. Elles sont gardées.',
    );
  });

  it('abaissé ou inchangé : aucun aperçu, aucune phrase', async () => {
    mockApercuAge = { data: { dryRun: true, minAge: 16, reservationsPlusJeunes: 0 } };
    const arbre = await monter();
    expect(mockApercusAge.every(([, , options]) => options.enabled === false)).toBe(true);
    await appuyer(arbre, '16 ans');
    expect(mockApercusAge.every(([, , options]) => options.enabled === false)).toBe(true);
    expect(lisibles(arbre).some((texte) => texte.includes('comptent des joueurs'))).toBe(false);
  });
});

describe('RESA-L5A1 E-G16 — chargement, erreur, refus (état 5)', () => {
  it('erreur : « Impossible de charger tes réglages. » et « Réessayer »', async () => {
    mockComplexe = { data: undefined, error: new Error('boum'), refetch: mockRelire };
    const arbre = await monter();
    expect(lisibles(arbre)).toContain('Impossible de charger tes réglages.');
    await appuyer(arbre, 'Réessayer');
    expect(mockRelire).toHaveBeenCalledTimes(1);
  });

  it('un refus du serveur s’affiche, la saisie reste', async () => {
    mockModifier.mockRejectedValueOnce({
      details: { code: 'COMPLEXE_RETIRED' }, message: 'retiré', status: 409,
    });
    const arbre = await monter();
    await appuyer(arbre, 'Enregistrer');
    expect(lisibles(arbre)).toContain('Ce complexe a été retiré de FoundClub.');
  });
});
