/* eslint-disable max-len -- donnees de test : les fixtures se lisent mieux sur une ligne */
// 🚩 R17-SIGNALER-1 (19/10/2026, REC17-011) — « Signaler un problème ici », sous le lieu de la fiche
// d une seance (planche P10-signaler-tel, ecran 1 b). Le serveur dit si la seance s en sert
// (`facilityReportable` : installation de la Ville, lecteur qui peut la signaler) ; sinon, rien.
import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import FacilityReportEntry from '../FacilityReportEntry';

/** @type {any} */
let mockNavigation;

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (/** @type {string} */ _cle, /** @type {string} */ defaut) => defaut }),
}));
jest.mock('@/theme/themeContext', () => {
  const couleurs = jest.requireActual('@/theme/colors').default();
  return {
    __esModule: true,
    default: () => ({ Colors: couleurs, Fonts: jest.requireActual('@/theme/fonts').default(couleurs), Images: {} }),
  };
});

const monter = (/** @type {any} */ event) => {
  /** @type {any} */
  let arbre;
  act(() => { arbre = renderer.create(<FacilityReportEntry event={event} navigation={mockNavigation} />); });
  return arbre;
};

beforeEach(() => { mockNavigation = { navigate: jest.fn() }; });

describe('R17SS1 — « Signaler un problème ici »', () => {
  it('le serveur dit oui : la rangée, qui ouvre le formulaire avec le lieu et la séance', () => {
    const arbre = monter({
      documentId: 'evt-1', facility: { documentId: 'gym-tilleuls', name: 'Gymnase des Tilleuls' }, facilityReportable: true,
    });
    expect(arbre.root.findAllByType(Text).map((n) => n.props.children)).toContain('Signaler un problème ici');
    act(() => { arbre.root.findByType(TouchableOpacity).props.onPress(); });
    expect(mockNavigation.navigate).toHaveBeenCalledWith('FacilityReportNew', {
      eventId: 'evt-1', facilityId: 'gym-tilleuls', facilityName: 'Gymnase des Tilleuls',
    });
  });

  it('le serveur ne dit rien (installation de club, visiteur) : rien ne s affiche', () => {
    [
      { documentId: 'evt-2', facility: { documentId: 'terrain-club' } },
      { documentId: 'evt-3', facilityReportable: true },
      null,
    ].forEach((event) => {
      expect(monter(event).toJSON()).toBeNull();
    });
  });
});
