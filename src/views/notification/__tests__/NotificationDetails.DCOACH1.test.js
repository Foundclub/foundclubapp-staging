import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import NotificationDetails from '../NotificationDetails';

/**
 * REPRISE-MESSAGERIE D-COACH-1 et p48 (01/11, revue « pas bon ») — LA FICHE D'UNE NOTIFICATION
 * SANS ÉCRAN À ELLE.
 *
 * Ce fichier n'avait aucun test (E6) : le premier bloc décrit le refus de participation, que la
 * fiche montrait déjà bien. Le second, ce que l'entraîneur a vu en touchant « Hugo L. sera
 * présent » : « Statut : complexeReservationJoueur » en rouge, « Événement indisponible » et
 * « Aucun motif précisé par l'organisateur », qui n'ont pas de sens ici.
 */

const mockRoute = { params: {} };

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ canGoBack: () => true, goBack: jest.fn(), navigate: jest.fn() }),
  useRoute: () => mockRoute,
}));

const mockInvalidateQueries = jest.fn();
jest.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    data: undefined, isError: false, isLoading: false, refetch: jest.fn(),
  }),
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));

jest.mock('@/theme/themeContext', () => {
  const ramp = () => new Proxy({}, { get: () => ({}) });
  return {
    __esModule: true,
    default: () => ({
      Alignments: ramp(),
      Colors: new Proxy({}, { get: (_cible, cle) => `couleur-${String(cle)}` }),
      Fonts: ramp(),
      Spaces: ramp(),
    }),
  };
});

jest.mock('react-i18next', () => ({
  initReactI18next: { init: jest.fn(), type: '3rdParty' },
  useTranslation: () => ({ t: (cle, repli) => (typeof repli === 'string' ? repli : cle) }),
}));

jest.mock('@/components/atoms/headerBackButton/HeaderBackButton', () => () => null);

jest.mock('@/components/atoms/button/Button', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function BoutonDouble(/** @type {any} */ props) {
    return react.createElement(rn.Text, null, props.title);
  };
});

jest.mock('@/components/templates/ScreenContainer', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function ScreenContainerDouble(/** @type {any} */ props) {
    return react.createElement(rn.View, null, props.children);
  };
});

jest.mock('@/services/notification/notificationService', () => ({
  getNotificationById: jest.fn(),
  markAsRead: jest.fn(async () => undefined),
}));

/**
 * Le texte visible de la fiche, ouverte sur cette notification.
 * @param {Record<string, unknown>} notification La notification passée par la liste.
 * @returns {string} Tous ses textes, mis bout à bout.
 */
const ficheDe = (notification) => {
  mockRoute.params = { notification };
  /** @type {any} */
  let arbre;
  act(() => { arbre = renderer.create(<NotificationDetails />); });
  return arbre.root.findAllByType(Text).map((noeud) => [noeud.props.children].flat().join(''))
    .join(' | ');
};

// FIN-CLOCHE (02/11/2026) — ouvrir une fiche la marque lue : la cloche et le panneau se relisent
// une fois le serveur à jour, sinon ils restent en retard jusqu'à leur prochaine lecture.
describe('FIN-CLOCHE — la fiche lue relit la cloche', () => {
  test('une notification non lue : marquée, puis relecture', async () => {
    mockInvalidateQueries.mockClear();
    mockRoute.params = {
      notification: {
        body: 'Corps',
        createdAt: '2026-10-30T03:29:00.000Z',
        documentId: 'n-9',
        read: false,
        title: 'Titre',
        type: 'complexeStatut',
      },
    };
    await act(async () => { renderer.create(<NotificationDetails />); });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['notifications'] });
  });
});

describe('fiche d une notification — le refus de participation (inchangé)', () => {
  test('le refus garde son statut, son événement, son motif et sa date de décision', () => {
    const texte = ficheDe({
      createdAt: '2026-10-30T03:29:00.000Z',
      data: { eventDetails: 'Match U11 samedi', reason: 'Effectif complet', status: 'declined' },
      documentId: 'n-1',
      read: true,
      title: 'Demande refusée',
      type: 'participationDeclined',
    });

    expect(texte).toContain('| Statut | Refusée |');
    expect(texte).toContain('| Événement | Match U11 samedi |');
    expect(texte).toContain('| Motif | Effectif complet |');
    expect(texte).toContain('| Date | 30 oct. 2026');
  });
});

describe('REPRISE-MESSAGERIE D-COACH-1 — une notification sans écran à elle', () => {
  test.each([
    ['complexeReservationJoueur', 'Nouvelle réponse', 'Hugo L. sera présent samedi 10 h (2/4).'],
    ['clubInterestResponse', 'Réponse du club', 'Réponse concernant U11 : Merci pour ton intérêt.'],
  ])('%s : son texte et sa date, sans code brut ni lignes d événement', (type, titre, corps) => {
    const texte = ficheDe({
      body: corps,
      createdAt: '2026-10-30T03:29:00.000Z',
      documentId: 'n-2',
      read: true,
      title: titre,
      type,
    });

    expect(texte).toContain(corps);
    expect(texte).not.toContain(type);
    expect(texte).not.toContain('| Statut |');
    expect(texte).not.toContain('| Événement |');
    expect(texte).not.toContain('| Motif |');
    expect(texte).toContain('| Reçue le | 30 oct. 2026');
  });
});
