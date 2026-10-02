import { createElement } from 'react';
import { TextInput } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { EventWizardProvider, useEventWizard } from '../EventWizardContext';
import EventWizardDescription from '../EventWizardDescription';
import { getEventDescriptionExample } from '../eventWizardDetectionUtils';

// FINITIONS7 · POINT 8 (tournee 8, 01/10) — L EXEMPLE DE DESCRIPTION D UN ENTRAINEMENT PARLAIT
// D UNE DETECTION.
//
// Releve : en creant (et en modifiant) un ENTRAINEMENT, le champ « Description » proposait
// « Ex. : viens essayer le foot avec les U15 — … l'essai est gratuit » (assistant) et
// « Événement de détection ouvert à tous·tes les joueur·se·s. » (EventEdit) : un exemple de
// DETECTION, quel que soit le type choisi. Et la phrase sous le champ promettait que « une
// description claire double les inscriptions sur une détection ».
// ✅ Attendu : un exemple propre a chaque type (detection, entrainement, match, tournoi, stage,
// autre), choisi par le meme sens des types que le reste du tunnel (`eventWizardDetectionUtils`).

jest.mock('react-i18next', () => ({
  initReactI18next: { init: () => {}, type: '3rdParty' },
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => (
      typeof repli === 'string' ? repli : cle
    ),
  }),
}));

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

jest.mock('@/components/molecules/wizardStepLayout/WizardStepLayout', () => function GabaritMock(
  /** @type {any} */ props,
) {
  return props.children;
});

// Le dispatch du tunnel, capte pour semer le type d'evenement.
let semer = (/** @type {any} */ action) => action;
/**
 * Capte le dispatch du tunnel, pour semer le type d evenement.
 * @returns {null} Rien : il ne rend aucun element.
 */
function PriseDeCourant() {
  const { dispatch } = useEventWizard();
  semer = dispatch;
  return null;
}

/** @type {any} */
let arbre = null;

/**
 * Monte l etape « Description » pour un type d evenement.
 * @param {string} nomDuType Le nom du type, tel que le serveur le donne.
 * @returns {{ exemple: string, textes: string }} L exemple du champ et le texte sous lui.
 */
const afficherPour = (nomDuType) => {
  const navigation = { goBack: () => {}, navigate: () => {} };
  act(() => {
    arbre = renderer.create(createElement(
      EventWizardProvider,
      null,
      createElement(PriseDeCourant),
      createElement(EventWizardDescription, { navigation, route: { params: {} } }),
    ));
  });
  act(() => semer({ payload: { documentId: 't-1', name: nomDuType }, type: 'SET_TYPE' }));
  const champ = arbre.root.findByType(TextInput);
  const textes = arbre.root.findAll((/** @type {any} */ n) => n.type === 'Text')
    .map((/** @type {any} */ n) => [].concat(n.props.children).join(''))
    .join(' | ');
  return { exemple: String(champ.props.placeholder), textes };
};

afterEach(() => {
  if (arbre) act(() => arbre.unmount());
  arbre = null;
});

describe('FINITIONS7 · point 8 — un exemple de description par type d evenement', () => {
  test('🚨 un ENTRAINEMENT ne parle plus de detection ni d essai gratuit', () => {
    const { exemple, textes } = afficherPour('Entraînement');

    expect(exemple).toMatch(/^Ex\. : /);
    expect(exemple).not.toMatch(/d[ée]tection|essayer|essai/i);
    expect(textes).not.toMatch(/d[ée]tection/i);
  });

  test('la DETECTION garde son exemple et sa promesse', () => {
    const { exemple, textes } = afficherPour('Détection');

    expect(exemple).toMatch(/viens essayer/);
    expect(textes).toMatch(/inscriptions sur une détection/);
  });

  test.each([
    ['Match', /match/i],
    ['Tournoi', /tournoi/i],
    ['Stage', /stage/i],
  ])('🚨 %s a son propre exemple', (nomDuType, motif) => {
    const { exemple } = afficherPour(nomDuType);

    expect(exemple).toMatch(motif);
    expect(exemple).not.toMatch(/d[ée]tection|essayer/i);
  });

  test('🚨 six types, six exemples differents (et un repli pour un type inconnu)', () => {
    const exemples = ['Détection', 'Entraînement', 'Match', 'Tournoi', 'Stage', 'Réunion']
      .map((nom) => getEventDescriptionExample(nom, (
        /** @type {string} */ cle,
        /** @type {string} */ repli,
      ) => repli || cle));

    expect(new Set(exemples).size).toBe(6);
  });
});
