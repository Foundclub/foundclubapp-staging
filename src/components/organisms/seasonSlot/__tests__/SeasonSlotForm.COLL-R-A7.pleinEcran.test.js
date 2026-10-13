/* eslint-disable max-len -- donnees de test : les fixtures se lisent mieux sur une ligne */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Modal, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';

import {
  attributeSeasonSlot,
  getClubTeamsForSlot,
  listFacilitySeasonSlots,
  modifySeasonSlot,
  previewFacilitySeasonSlot,
} from '@/services/seasonSlot/seasonSlotService';

import SeasonSlotForm from '../SeasonSlotForm';

// 📐 COLL-R-A7 (13/10/2026, COL-005) — « Attribuer un créneau » en PLEIN ÉCRAN au téléphone.
// Décision d'Adel D4 A (13/10 ~02h22, « Ok je valide tout »), planche P4v4-attribuer validée :
// le gabarit des tunnels « Créer un événement » (WizardStepLayout, en-tête `focus`), ouvert dans
// une fenêtre plein écran par l'écran lui-même (aucune route neuve) ; un titre en question par
// étape ; la croix quitte, la flèche revient d'une étape sans rien perdre ; le récapitulatif se
// touche ligne par ligne ; « Attribuer quand même » et « Changer l'heure » quand c'est complet.
// ROUGES avant le lot : le formulaire ne savait s'ouvrir que dans une feuille du bas (S04, S05).
// Banc : les doublures de SeasonSlotForm.IPH09.tunnel.test.js ; le VRAI gabarit des tunnels.

const i18nextTemoin = require('i18next');

const frTemoin = require('@/theme/strings/translations/fr');

(i18nextTemoin.default || i18nextTemoin).init({
  compatibilityJSON: 'v4',
  fallbackLng: 'fr',
  lng: 'fr',
  resources: { fr: { translation: frTemoin.default } },
});

/** @type {any[]} */
const mockHeureProps = [];

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {any[]} */ ...args) => jest.requireActual('i18next').t(...args),
  }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 34, left: 0, right: 0, top: 47,
  }),
}));
jest.mock('@/services/seasonSlot/seasonSlotService', () => ({
  attributeSeasonSlot: jest.fn(),
  getClubTeamsForSlot: jest.fn(),
  listFacilitySeasonSlots: jest.fn(),
  modifySeasonSlot: jest.fn(),
  previewFacilitySeasonSlot: jest.fn(),
}));
jest.mock('@/services/collectivite/collectiviteService', () => ({
  getCollectiviteChiffres: jest.fn(),
}));
jest.mock('@/services/facility/facilityService', () => ({ getFacilityPlanning: jest.fn() }));
jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const genererStyles = jest.requireActual('@/theme/applicationStyle').default;
  const alignements = jest.requireActual('@/theme/alignements').default;
  const espaces = jest.requireActual('@/theme/spaces').default;
  const couleurs = genererCouleurs();
  return {
    __esModule: true,
    default: () => ({
      Alignments: alignements,
      ApplicationStyle: genererStyles(couleurs),
      Colors: couleurs,
      Fonts: genererPolices(couleurs),
      Images: {},
      Spaces: espaces,
    }),
  };
});
jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return function ButtonMock(/** @type {any} */ props) {
    return reactActuel.createElement(PressableRN, { disabled: props.disabled, onPress: props.onPress }, reactActuel.createElement(TexteRN, null, props.title));
  };
});
// Le fond d'écran du gabarit (dégradé natif) : hors de ce banc, comme dans les témoins d'écran.
jest.mock('@/components/templates/ScreenContainer', () => function ScreenContainerMock({ children }) { return children; });
jest.mock('@/components/molecules/clubLogoMark/ClubLogoMark', () => function ClubLogoMarkMock() { return null; });
jest.mock('@/components/molecules/timePickerInput/TimePickerInput', () => function TimePickerInputMock(/** @type {any} */ props) {
  mockHeureProps.push(props);
  return null;
});
jest.mock('@/components/molecules/datePickerInput/DatePickerInput', () => function DatePickerInputMock() { return null; });
jest.mock('@/components/organisms/seasonSlot/RondsDePlaces', () => function RondsDePlacesMock() { return null; });

// Le vrai gabarit des tunnels, une dizaine de gestes par témoin : la marge du dépôt.
jest.setTimeout(30000);

const SAISON = { validFrom: '2026-09-01', validUntil: '2027-06-30' };
const INSTALLATIONS = [
  {
    documentId: 'salle-t18', maxSlots: 2, name: 'T18 Salle essai', planningColor: '#3B82F6', type: 'gymnase',
  },
  { documentId: 'terrain', maxSlots: 2, name: 'Terrain' },
  { documentId: 'dojo', maxSlots: 1, name: 'Dojo' },
];

/** @type {any[]} */
const arbresMontes = [];
const tours = async () => {
  for (let tour = 0; tour < 3; tour += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => { await new Promise((fini) => { setTimeout(fini, 0); }); });
  }
};
const monter = async (/** @type {any} */ props = {}) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <QueryClientProvider client={client}>
        <SeasonSlotForm
          actionSecondaire={props.actionSecondaire}
          clubs={props.clubs || [{ documentId: 'basket', name: 'Montrivage Basket' }, { documentId: 'football', name: 'STADE MARSEILLAIS UNIVERSITE CLUB (SMUC)' }]}
          compact={props.compact}
          facilities={props.facilities}
          facilityId={props.facilities ? null : 'salle-t18'}
          fixedClubId={props.fixedClubId}
          guided
          initial={props.initial}
          onCancel={props.onCancel || jest.fn()}
          onDone={props.onDone || jest.fn()}
          pleinEcran
          slot={props.slot}
        />
      </QueryClientProvider>,
    );
  });
  await tours();
  arbresMontes.push(arbre);
  return arbre;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockHeureProps.length = 0;
  /** @type {any} */ (getClubTeamsForSlot).mockResolvedValue([{ documentId: 'u13', name: 'U13' }]);
  /** @type {any} */ (listFacilitySeasonSlots).mockResolvedValue({
    data: [],
    meta: { facility: { ...INSTALLATIONS[0], plateaux: [] }, season: SAISON },
  });
  /** @type {any} */ (previewFacilitySeasonSlot).mockResolvedValue({ data: { capacity: 2, needsConfirmation: false, occupants: [] } });
  /** @type {any} */ (attributeSeasonSlot).mockResolvedValue({ data: { documentId: 'neuf' } });
  /** @type {any} */ (modifySeasonSlot).mockResolvedValue({ data: {} });
});
afterEach(() => {
  act(() => { arbresMontes.splice(0).forEach((arbre) => arbre.unmount()); });
});

const tunnel = (/** @type {any} */ arbre) => arbre.root.findByType(WizardStepLayout).props;
const fenetre = (/** @type {any} */ arbre) => arbre.root.findByType(Modal).props;
const appeler = async (/** @type {() => any} */ geste) => {
  await act(async () => { await geste(); });
  await tours();
};
const avancer = (/** @type {any} */ arbre) => {
  expect(tunnel(arbre).isNextDisabled).not.toBe(true);
  return appeler(() => tunnel(arbre).onNext());
};
const choix = (/** @type {any} */ arbre, /** @type {string} */ libelle) => arbre.root.findAll(
  (/** @type {any} */ n) => n.props.accessibilityRole === 'radio' && typeof n.props.onPress === 'function'
    && n.findAllByType(Text).some((/** @type {any} */ x) => [].concat(x.props.children).join('') === libelle),
)[0];
const choisir = async (/** @type {any} */ arbre, /** @type {string} */ libelle) => {
  const cible = choix(arbre, libelle);
  expect(cible).toBeDefined();
  await appeler(() => cible.props.onPress());
};
const ligneDuRecap = (/** @type {any} */ arbre, /** @type {string} */ cle) => arbre.root.findAll(
  (/** @type {any} */ n) => n.props.testID === `recap-${cle}`,
)[0];
const lus = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ n) => [].concat(n.props.children).join(''));
const choisirHeure = async (/** @type {string} */ label, /** @type {string} */ valeur) => {
  const champ = mockHeureProps.filter((p) => p.label === label).at(-1);
  await appeler(() => champ.onChange(valeur));
};

describe('COLL-R-A7 — COL-005 : « Attribuer un créneau » en plein écran', () => {
  test('1. une fenêtre plein écran, le gabarit des tunnels (en-tête focus) : « Pour quel club ? », étape 1/5, la croix seule', async () => {
    const onCancel = jest.fn();
    const arbre = await monter({ onCancel });
    expect(fenetre(arbre).presentationStyle).toBe('fullScreen');
    expect(fenetre(arbre).statusBarTranslucent).toBe(true);
    expect(tunnel(arbre)).toEqual(expect.objectContaining({
      headerVariant: 'focus',
      stepCount: 5,
      stepIndex: 1,
      subtitle: 'T18 Salle essai · 2 équipes à la fois',
      title: 'Pour quel club ?',
    }));
    expect(tunnel(arbre).onBack).toBeUndefined();
    expect(lus(arbre)).not.toContain('Club');
    await appeler(() => tunnel(arbre).onClose());
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  test('2. une question par étape, le sous-titre relit les choix ; « Attribuer le créneau » au récapitulatif', async () => {
    const onDone = jest.fn();
    const arbre = await monter({ onDone });
    await choisir(arbre, 'Montrivage Basket');
    await avancer(arbre);
    expect(tunnel(arbre)).toEqual(expect.objectContaining({ subtitle: 'Montrivage Basket · facultatif', title: 'Pour quelle équipe ?' }));
    expect(lus(arbre)).toContain('Le club répartit lui-même ses équipes.');
    await choisir(arbre, 'U13');
    await avancer(arbre);
    expect(tunnel(arbre)).toEqual(expect.objectContaining({ subtitle: 'Montrivage Basket · U13 · chaque semaine de la saison', title: 'Quel jour ?' }));
    await choisir(arbre, 'Mercredi');
    await avancer(arbre);
    expect(tunnel(arbre)).toEqual(expect.objectContaining({ subtitle: 'Chaque mercredi · T18 Salle essai', title: 'À quelle heure ?' }));
    await choisirHeure('Début', '17:30');
    await choisirHeure('Fin', '19:00');
    await avancer(arbre);
    expect(tunnel(arbre)).toEqual(expect.objectContaining({
      nextLabel: 'Attribuer le créneau',
      stepIndex: 5,
      subtitle: 'Relisez, puis attribuez. Le club est prévenu.',
      title: 'Récapitulatif',
    }));
    expect(lus(arbre)).toEqual(expect.arrayContaining([
      'Montrivage Basket · U13',
      'Chaque mercredi · 17:30 – 19:00',
      'Toute la saison · 1 sept. – 30 juin',
      'Montrivage Basket sera prévenu, et verra ce créneau dans son planning.',
    ]));
    expect(attributeSeasonSlot).not.toHaveBeenCalled();
    await appeler(() => tunnel(arbre).onNext());
    expect(attributeSeasonSlot).toHaveBeenCalledWith('salle-t18', {
      club: 'basket', endTime: '19:00', startTime: '17:30', team: 'u13', weekday: 3,
    });
    expect(onDone).toHaveBeenCalledWith({ documentId: 'neuf' });
  });

  test('3. les choix sont des lignes à cocher ; un nom long n’est jamais coupé', async () => {
    const arbre = await monter();
    const ligne = choix(arbre, 'STADE MARSEILLAIS UNIVERSITE CLUB (SMUC)');
    expect(ligne.props.accessibilityState).toEqual({ checked: false });
    expect(ligne.findAllByType(Text).every((/** @type {any} */ n) => n.props.numberOfLines === undefined)).toBe(true);
    expect(tunnel(arbre).isNextDisabled).toBe(true);
    await choisir(arbre, 'STADE MARSEILLAIS UNIVERSITE CLUB (SMUC)');
    expect(choix(arbre, 'STADE MARSEILLAIS UNIVERSITE CLUB (SMUC)').props.accessibilityState).toEqual({ checked: true });
    expect(tunnel(arbre).isNextDisabled).toBe(false);
  });

  test('4. la flèche et le retour d’Android reviennent d’une étape sans rien perdre ; à l’étape 1, ils quittent', async () => {
    const onCancel = jest.fn();
    const arbre = await monter({ onCancel });
    await choisir(arbre, 'Montrivage Basket');
    await avancer(arbre);
    await choisir(arbre, 'U13');
    await appeler(() => tunnel(arbre).onBack());
    expect(tunnel(arbre).title).toBe('Pour quel club ?');
    await avancer(arbre);
    expect(choix(arbre, 'U13').props.accessibilityState).toEqual({ checked: true });
    await appeler(() => fenetre(arbre).onRequestClose());
    expect(tunnel(arbre).title).toBe('Pour quel club ?');
    expect(onCancel).not.toHaveBeenCalled();
    await appeler(() => fenetre(arbre).onRequestClose());
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  test('5. complet : « Attribuer quand même » et « Changer l’heure » au récapitulatif, ce dernier revient aux heures', async () => {
    /** @type {any} */ (previewFacilitySeasonSlot).mockResolvedValue({
      data: {
        capacity: 1, needsConfirmation: true, occupants: [], teamsAfter: 2,
      },
    });
    const arbre = await monter({ initial: { endTime: '19:00', startTime: '17:30', weekday: 4 } });
    await choisir(arbre, 'Montrivage Basket');
    await avancer(arbre);
    await avancer(arbre);
    await avancer(arbre);
    expect(tunnel(arbre).nextLabel).toBe('Suivant');
    await avancer(arbre);
    expect(tunnel(arbre)).toEqual(expect.objectContaining({
      nextLabel: 'Attribuer quand même', showSkip: true, skipLabel: 'Changer l’heure',
    }));
    await appeler(() => tunnel(arbre).onSkip());
    expect(tunnel(arbre).title).toBe('À quelle heure ?');
    await choisirHeure('Début', '20:00');
    await choisirHeure('Fin', '21:30');
    await avancer(arbre);
    await appeler(() => tunnel(arbre).onNext());
    expect(attributeSeasonSlot).toHaveBeenCalledWith('salle-t18', expect.objectContaining({ confirmOverCapacity: true, startTime: '20:00' }));
  });

  test('6. l’action de l’écran (« Bloquer pour la Ville ») reste sous la main', async () => {
    const bloquer = jest.fn();
    const arbre = await monter({
      actionSecondaire: { libelle: 'Bloquer pour la Ville', onPress: bloquer },
      compact: true,
      initial: { endTime: '19:30', startTime: '18:00', weekday: 3 },
    });
    expect(tunnel(arbre)).toEqual(expect.objectContaining({ showSkip: true, skipLabel: 'Bloquer pour la Ville' }));
    await appeler(() => tunnel(arbre).onSkip());
    expect(bloquer).toHaveBeenCalledTimes(1);
  });

  test('7. fiche d’un club : « Dans quelle installation ? » (son type, sa place), étape 1/5', async () => {
    const arbre = await monter({ clubs: [{ documentId: 'basket', name: 'Montrivage Basket' }], facilities: INSTALLATIONS, fixedClubId: 'basket' });
    expect(tunnel(arbre)).toEqual(expect.objectContaining({
      stepCount: 5, stepIndex: 1, subtitle: 'Pour Montrivage Basket', title: 'Dans quelle installation ?',
    }));
    expect(lus(arbre)).toContain('Dojo');
    expect(lus(arbre)).toContain('1 équipe à la fois');
    await choisir(arbre, 'Terrain');
    await avancer(arbre);
    expect(tunnel(arbre).title).toBe('Pour quelle équipe ?');
  });

  test('8. depuis une heure libre du planning : 3 étapes, le moment au sous-titre ; « Jour et heures » se touche et rouvre ses étapes', async () => {
    const arbre = await monter({ compact: true, initial: { endTime: '19:30', startTime: '18:00', weekday: 3 } });
    expect(tunnel(arbre)).toEqual(expect.objectContaining({
      stepCount: 3, subtitle: 'Mercredi 18:00 – 19:30 · T18 Salle essai', title: 'Pour quel club ?',
    }));
    await choisir(arbre, 'Montrivage Basket');
    await avancer(arbre);
    await avancer(arbre);
    expect(tunnel(arbre)).toEqual(expect.objectContaining({ nextLabel: 'Attribuer le créneau', stepIndex: 3, title: 'Récapitulatif' }));
    expect(lus(arbre)).toEqual(expect.arrayContaining(['Chaque mercredi · 18:00 – 19:30', 'Toute la saison · 1 sept. – 30 juin']));
    expect(lus(arbre)).not.toContain('Chaque mercredi de la saison (1 sept. – 30 juin). Le club est prévenu.');
    await appeler(() => ligneDuRecap(arbre, 'heures').props.onPress());
    expect(tunnel(arbre)).toEqual(expect.objectContaining({ stepCount: 5, stepIndex: 3, title: 'Quel jour ?' }));
    expect(choix(arbre, 'Mercredi').props.accessibilityState).toEqual({ checked: true });
  });

  test('9. le récapitulatif se touche : « Club · équipe » revient au club, rien n’est perdu', async () => {
    const arbre = await monter({ initial: { endTime: '19:00', startTime: '17:30', weekday: 2 } });
    await choisir(arbre, 'Montrivage Basket');
    await avancer(arbre);
    await avancer(arbre);
    await avancer(arbre);
    await avancer(arbre);
    expect(tunnel(arbre).title).toBe('Récapitulatif');
    expect(ligneDuRecap(arbre, 'installation').props.onPress).toBeUndefined();
    expect(ligneDuRecap(arbre, 'periode').props.onPress).toBeUndefined();
    await appeler(() => ligneDuRecap(arbre, 'club').props.onPress());
    expect(tunnel(arbre).title).toBe('Pour quel club ?');
    expect(choix(arbre, 'Montrivage Basket').props.accessibilityState).toEqual({ checked: true });
  });
});
