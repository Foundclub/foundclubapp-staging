/* eslint-disable max-len -- donnees de test : les fixtures se lisent mieux sur une ligne */
// 🗓️ R17-CONTROLES (20/10/2026, REC17-011 lot 2, decision d Adel Q6 B) — « NOTER UN CONTRÔLE » (planche
// validee P11-q6-exemple-tel ecran 1) et « NOTER LE CONTRÔLE FAIT » (ecran 4 : la ligne est reprise,
// restent la date et le rapport, le prochain se recalcule). Ce que le temoin fixe :
//   - « Quel contrôle ? », « Fait le » (aujourd hui), « Par », « Prochain contrôle » (un an apres,
//     recalcule tant qu on ne l a pas touche) et « Proposé : un an après. Modifiable. » ;
//   - « Joindre le rapport (PDF, facultatif) » : le selecteur de documents, le nom, « Retirer » ;
//   - les refus de l app (nom manquant, prochain avant le fait) et ceux du serveur (son code traduit) ;
//   - refait : pas d intitule a saisir, « Par » repris, le meme ecart que la fois precedente.
import { Text, TextInput } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import FacilityCheckForm from '../FacilityCheckForm';

jest.setTimeout(30000);

const i18nextTemoin = require('i18next');

const frTemoin = require('@/theme/strings/translations/fr');

(i18nextTemoin.default || i18nextTemoin).init({
  compatibilityJSON: 'v4', fallbackLng: 'fr', lng: 'fr', resources: { fr: { translation: frTemoin.default } },
});

/** @type {any} */
let mockCarnet;
/** @type {any} */
let mockNoter;
/** @type {any} */
let mockNoterFait;
/** @type {any[]} */
const mockGabarits = [];
const mockChoisirDocument = jest.fn();

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (/** @type {any[]} */ ...args) => jest.requireActual('i18next').t(...args) }),
}));
jest.mock('@/theme/themeContext', () => {
  const couleurs = jest.requireActual('@/theme/colors').default();
  return {
    __esModule: true,
    default: () => ({
      Alignments: jest.requireActual('@/theme/alignements').default,
      ApplicationStyle: jest.requireActual('@/theme/applicationStyle').default(couleurs),
      Colors: couleurs,
      Fonts: jest.requireActual('@/theme/fonts').default(couleurs),
      Images: {},
      Spaces: jest.requireActual('@/theme/spaces').default,
    }),
  };
});
jest.mock('@/services/facilityCheck/facilityCheckQueries', () => ({
  useCreateFacilityCheck: () => mockNoter,
  useFacilityChecks: () => mockCarnet,
  useMarkFacilityCheckDone: () => mockNoterFait,
}));
jest.mock('@/platform/media', () => ({ __esModule: true, default: { pickDocument: (...args) => mockChoisirDocument(...args) } }));
jest.mock('@/components/organisms/seasonSlot/SeasonSlotForm', () => ({
  FenetrePleinEcran: function FenetreMock({ children }) { return children; },
}));
jest.mock('@/components/molecules/wizardStepLayout/WizardStepLayout', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity, View } = jest.requireActual('react-native');
  return function GabaritMock(/** @type {any} */ props) {
    mockGabarits.push(props);
    return reactActuel.createElement(
      View,
      null,
      reactActuel.createElement(TexteRN, null, props.title),
      props.children,
      reactActuel.createElement(TouchableOpacity, { onPress: props.onNext, testID: 'gabarit-suivant' }),
    );
  };
});
jest.mock('@/components/molecules/datePickerInput/DatePickerInput', () => {
  const reactActuel = jest.requireActual('react');
  const { TextInput: Champ } = jest.requireActual('react-native');
  return function DateMock(/** @type {any} */ props) {
    return reactActuel.createElement(Champ, { onChangeText: props.onChange, testID: props.testID, value: props.value });
  };
});
jest.mock('@/components/molecules/input/Input', () => {
  const reactActuel = jest.requireActual('react');
  const { TextInput: Champ } = jest.requireActual('react-native');
  return function InputMock(/** @type {any} */ props) {
    return reactActuel.createElement(Champ, { onChangeText: props.onChangeText, testID: props.testID, value: props.value });
  };
});

const BUTS = {
  current: true, document: null, documentId: 'c-buts-2', doneBy: 'Société Exemple', doneOn: '2026-03-12', label: 'Buts et paniers', nextDue: '2027-03-12', series: 's-buts', state: 'a_jour',
};
const PDF = { name: 'rapport-buts.pdf', type: 'application/pdf', uri: 'file:///cache/rapport-buts.pdf' };

const monter = (/** @type {{ pleinEcran?: boolean, series?: string }} */ { pleinEcran = false, series = null } = {}) => {
  const onCancel = jest.fn();
  const onDone = jest.fn();
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(<FacilityCheckForm facilityId="gym-tilleuls" facilityName="Gymnase des Tilleuls" onCancel={onCancel} onDone={onDone} pleinEcran={pleinEcran} series={series} />);
  });
  return { arbre, onCancel, onDone };
};
const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text).map((/** @type {any} */ n) => [].concat(n.props.children).join(''));
const champ = (/** @type {any} */ arbre, /** @type {string} */ id) => arbre.root.findAllByType(TextInput).find((/** @type {any} */ n) => n.props.testID === id);
const ecrire = async (/** @type {any} */ arbre, /** @type {string} */ id, /** @type {string} */ texte) => {
  await act(async () => { champ(arbre, id).props.onChangeText(texte); });
};
const parId = (/** @type {any} */ arbre, /** @type {string} */ id) => arbre.root.findAll((/** @type {any} */ n) => n.props.testID === id && typeof n.type !== 'string');
const enregistrer = async (/** @type {any} */ arbre) => {
  const [bouton] = arbre.root.findAll((/** @type {any} */ n) => n.props.title === 'Enregistrer' && typeof n.type !== 'string');
  await act(async () => { await bouton.props.onPress(); });
};

beforeEach(() => {
  mockCarnet = { data: { data: [BUTS], meta: { today: '2026-10-20' } }, isError: false, isLoading: false };
  mockNoter = { isPending: false, mutateAsync: jest.fn(() => Promise.resolve({ data: { ...BUTS, documentId: 'c-neuf', series: 's-neuve' } })) };
  mockNoterFait = { isPending: false, mutateAsync: jest.fn(() => Promise.resolve({ data: { ...BUTS, documentId: 'c-buts-3' } })) };
  mockChoisirDocument.mockReset();
  mockGabarits.length = 0;
});

describe('R17CTRL — « Noter un contrôle » (planche Q6 écran 1)', () => {
  it('les champs de la planche, « Fait le » aujourd hui, « Prochain » un an après, et la phrase qui le dit', () => {
    const { arbre } = monter();
    const tout = textes(arbre);
    expect(tout).toEqual(expect.arrayContaining(['Noter un contrôle', 'Gymnase des Tilleuls', 'Proposé : un an après. Modifiable.', 'Joindre le rapport (PDF, facultatif)']));
    expect(champ(arbre, 'controle-quel').props.value).toBe('');
    expect(champ(arbre, 'controle-fait-le').props.value).toBe('20/10/2026');
    expect(champ(arbre, 'controle-prochain').props.value).toBe('20/10/2027');
  });

  it('sans intitulé : « Nommez le contrôle. », rien ne part', async () => {
    const { arbre } = monter();
    await enregistrer(arbre);
    expect(textes(arbre)).toContain('Nommez le contrôle.');
    expect(mockNoter.mutateAsync).not.toHaveBeenCalled();
  });

  it('noté avec son rapport : le prochain suit la date faite, tout part, la fenêtre se ferme', async () => {
    mockChoisirDocument.mockResolvedValue([PDF]);
    const { arbre, onDone } = monter();
    await ecrire(arbre, 'controle-quel', 'Buts et paniers');
    await ecrire(arbre, 'controle-fait-le', '12/03/2026');
    expect(champ(arbre, 'controle-prochain').props.value).toBe('12/03/2027');
    await ecrire(arbre, 'controle-par', 'Société Exemple');
    await act(async () => { await parId(arbre, 'controle-rapport')[0].props.onPress(); });
    expect(textes(arbre)).toContain('rapport-buts.pdf');
    await enregistrer(arbre);
    expect(mockNoter.mutateAsync).toHaveBeenCalledWith({
      document: PDF, doneBy: 'Société Exemple', doneOn: '2026-03-12', facilityId: 'gym-tilleuls', label: 'Buts et paniers', nextDue: '2027-03-12',
    });
    expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ series: 's-neuve' }));
  });

  it('un prochain choisi à la main ne bouge plus ; avant la date faite : refusé par l app', async () => {
    const { arbre } = monter();
    await ecrire(arbre, 'controle-quel', 'Extincteurs');
    await ecrire(arbre, 'controle-prochain', '01/06/2027');
    await ecrire(arbre, 'controle-fait-le', '12/03/2026');
    expect(champ(arbre, 'controle-prochain').props.value).toBe('01/06/2027');
    await ecrire(arbre, 'controle-prochain', '01/01/2026');
    await enregistrer(arbre);
    expect(textes(arbre)).toContain('Le prochain contrôle vient après celui-ci.');
    expect(mockNoter.mutateAsync).not.toHaveBeenCalled();
  });

  it('un refus du serveur se dit avec SON code traduit ; le rapport se retire', async () => {
    mockChoisirDocument.mockResolvedValue([{ ...PDF, name: 'photo.gif', type: 'image/gif' }]);
    const refus = Object.assign(new Error('Le rapport est un PDF ou une photo.'), {
      response: { data: { error: { details: { code: 'FACILITY_CHECK_DOCUMENT_INVALID' }, message: 'Le rapport est un PDF ou une photo.', status: 400 } }, status: 400 },
    });
    mockNoter.mutateAsync = jest.fn(() => Promise.reject(refus));
    const { arbre, onDone } = monter();
    await ecrire(arbre, 'controle-quel', 'Buts et paniers');
    await act(async () => { await parId(arbre, 'controle-rapport')[0].props.onPress(); });
    await enregistrer(arbre);
    expect(textes(arbre)).toContain('Le rapport est un PDF ou une photo de 15 Mo au plus.');
    expect(onDone).not.toHaveBeenCalled();
    const [retirer] = arbre.root.findAll((/** @type {any} */ n) => n.props.accessibilityLabel === 'Retirer le rapport' && typeof n.type !== 'string');
    await act(async () => { retirer.props.onPress(); });
    expect(textes(arbre)).not.toContain('photo.gif');
  });

  it('au téléphone : la fenêtre plein écran, « Enregistrer » en bas', async () => {
    const { arbre } = monter({ pleinEcran: true });
    const gabarit = mockGabarits.at(-1);
    expect(gabarit.title).toBe('Noter un contrôle');
    expect(gabarit.subtitle).toBe('Gymnase des Tilleuls');
    expect(gabarit.nextLabel).toBe('Enregistrer');
    await ecrire(arbre, 'controle-quel', 'Buts et paniers');
    await act(async () => { await parId(arbre, 'gabarit-suivant')[0].props.onPress(); });
    expect(mockNoter.mutateAsync).toHaveBeenCalledTimes(1);
  });
});

describe('R17CTRL — « Noter le contrôle fait » (planche Q6 écran 4)', () => {
  it('la ligne reprise : pas d intitulé à saisir, « Par » repris, le même écart que la fois précédente', async () => {
    const { arbre, onDone } = monter({ series: 's-buts' });
    const tout = textes(arbre);
    expect(tout).toEqual(expect.arrayContaining(['Noter le contrôle fait', 'Buts et paniers', 'Proposé : le même écart que la fois précédente. Modifiable.']));
    expect(champ(arbre, 'controle-quel')).toBeUndefined();
    expect(champ(arbre, 'controle-par').props.value).toBe('Société Exemple');
    expect(champ(arbre, 'controle-prochain').props.value).toBe('20/10/2027');
    await enregistrer(arbre);
    expect(mockNoterFait.mutateAsync).toHaveBeenCalledWith({
      checkId: 'c-buts-2', document: null, doneBy: 'Société Exemple', doneOn: '2026-10-20', nextDue: '2027-10-20',
    });
    expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ documentId: 'c-buts-3' }));
  });
});
