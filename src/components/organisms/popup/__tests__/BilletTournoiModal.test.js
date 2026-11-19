// Le VRAI i18next : les libellés viennent de `fr.js`.
import '@/theme/strings';

import { createElement } from 'react';
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import BilletTournoiModal, { zonesDuBillet } from '../BilletTournoiModal';

// IMPL-4-ACCUEIL, page 5 (planche 5b, variante B « billet », Adel 18/11) — chaque zone du billet
// vient de la campagne ou de l'événement ; sans événement lisible, la fenêtre d'avant.

/** @type {{ data?: any, isLoading: boolean, isError?: boolean }} */
let mockLecture = { data: null, isLoading: false };
jest.mock('@/services/event/eventQueries', () => ({
  useGetEvent: jest.fn(() => mockLecture),
}));

jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const genererStyles = jest.requireActual('@/theme/applicationStyle').default;
  const couleurs = genererCouleurs();
  const polices = genererPolices(couleurs);
  const theme = {
    Alignments: jest.requireActual('@/theme/alignements').default,
    ApplicationStyle: genererStyles(couleurs),
    Colors: couleurs,
    Fonts: polices,
    Images: { close: 1 },
    Spaces: jest.requireActual('@/theme/spaces').default,
  };
  return { __esModule: true, default: () => theme };
});

jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity } = jest.requireActual('react-native');
  return function BoutonMock(/** @type {any} */ props) {
    return reactActuel.createElement(
      TouchableOpacity,
      { accessibilityRole: 'button', onPress: props.onPress },
      reactActuel.createElement(TexteRN, null, props.title),
    );
  };
});

const { useGetEvent } = jest.requireMock('@/services/event/eventQueries');

const TOURNOI = {
  date: '2026-12-19T00:00:00.000Z',
  documentId: 'evt-1',
  location: { address: '119 rue de la Rauze basse, Montpellier', name: 'AR Soccer' },
  name: 'FoundClub x AR Soccer - 19/12/2026',
  startTime: '19:00:00.000',
  tournamentConfig: { entryFeeCents: 2000 },
};

/** @type {any} */
let arbre = null;
afterEach(() => {
  if (arbre) act(() => arbre.unmount());
  arbre = null;
  mockLecture = { data: null, isLoading: false };
  useGetEvent.mockClear();
});

const monter = (/** @type {Record<string, any>} */ props = {}) => {
  const gestes = { fermer: jest.fn(), plusTard: jest.fn(), voir: jest.fn() };
  act(() => {
    arbre = renderer.create(createElement(BilletTournoiModal, {
      body: 'Monte ton équipe de 5 et inscris-la.',
      eventId: 'evt-1',
      eyebrow: 'Tournoi de foot à 5',
      imageUrl: 'https://exemple.test/photo.jpg',
      onRequestClose: gestes.fermer,
      primaryAction: { label: 'Voir le tournoi', onPress: gestes.voir },
      repli: <Text>fenetre-d-avant</Text>,
      title: 'FoundClub x AR Soccer',
      visible: true,
      ...props,
    }));
  });
  return gestes;
};

const textes = () => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ n) => n.props.children)
  .flat()
  .filter((/** @type {any} */ c) => typeof c === 'string');

const appuyer = (/** @type {string} */ libelle) => {
  const cible = arbre.root.findAll((/** @type {any} */ n) => typeof n.props?.onPress === 'function'
    && (n.props.accessibilityLabel === libelle
      || n.findAllByType(Text).some((/** @type {any} */ t) => t.props.children === libelle)))[0];
  act(() => cible.props.onPress());
};

describe('zonesDuBillet — d où vient chaque zone', () => {
  it('lit la date, l heure, le lieu court et le prix de l événement', () => {
    const campagne = { eyebrow: 'Tournoi de foot à 5', title: 'FoundClub x AR Soccer' };
    expect(zonesDuBillet(TOURNOI, campagne))
      .toEqual({
        date: 'Sam. 19 déc.',
        heure: '19 h',
        lieu: 'AR Soccer, Montpellier',
        marque: true,
        prix: '20 €',
        sousTitre: 'Tournoi de foot à 5',
        titre: 'x AR Soccer',
      });
  });

  it('sans titre de campagne, prend le nom de l événement', () => {
    expect(zonesDuBillet({ ...TOURNOI, name: 'Tournoi de Noël' }).titre).toBe('Tournoi de Noël');
    expect(zonesDuBillet({ ...TOURNOI, name: 'Tournoi de Noël' }).marque).toBe(false);
  });

  it('une case sans donnée reste vide (gratuit, sans heure, sans lieu)', () => {
    const zones = zonesDuBillet({ date: TOURNOI.date, name: 'Tournoi' });
    expect(zones?.prix).toBeNull();
    expect(zones?.heure).toBeNull();
    expect(zones?.lieu).toBeNull();
  });

  it('sans date : pas de billet', () => {
    expect(zonesDuBillet({ ...TOURNOI, date: null })).toBeNull();
  });
});

describe('BilletTournoiModal — la pop-up billet', () => {
  it('dessine le billet de l événement, la phrase, « Voir le tournoi » et « Plus tard »', () => {
    mockLecture = { data: TOURNOI, isLoading: false };
    monter();
    expect(useGetEvent).toHaveBeenCalledWith('evt-1', expect.anything());
    const vus = textes();
    expect(vus).toEqual(expect.arrayContaining([
      'TOURNOI DE FOOT À 5', 'FOUND', 'CLUB', 'X AR SOCCER', 'Sam. 19 déc.', 'dès 19 h',
      'AR Soccer, Montpellier', '20 €', 'PAR JOUEUR', 'Monte ton équipe de 5 et inscris-la.',
      'Voir le tournoi', 'Plus tard',
    ]));
    expect(vus).not.toContain('fenetre-d-avant');
  });

  it('« Voir le tournoi » suit l action principale', () => {
    mockLecture = { data: TOURNOI, isLoading: false };
    const gestes = monter();
    appuyer('Voir le tournoi');
    expect(gestes.voir).toHaveBeenCalledTimes(1);
  });

  it('« Plus tard » et la croix ferment, sans action secondaire', () => {
    mockLecture = { data: TOURNOI, isLoading: false };
    const gestes = monter();
    appuyer('Plus tard');
    expect(gestes.fermer).toHaveBeenCalledTimes(1);
    const croix = arbre.root.findAll((/** @type {any} */ n) => (
      n.props?.accessibilityRole === 'button'
      && n.props?.accessibilityLabel === 'Fermer'
    ));
    act(() => croix[0].props.onPress());
    expect(gestes.fermer).toHaveBeenCalledTimes(2);
  });

  it('« Plus tard » suit l action secondaire quand la campagne en a une', () => {
    mockLecture = { data: TOURNOI, isLoading: false };
    const secondaire = jest.fn();
    monter({ secondaryAction: { label: 'Plus tard', onPress: secondaire } });
    appuyer('Plus tard');
    expect(secondaire).toHaveBeenCalledTimes(1);
  });

  it('pendant la lecture de l événement : rien', () => {
    mockLecture = { data: undefined, isLoading: true };
    monter();
    expect(arbre.toJSON()).toBeNull();
  });

  it('événement illisible : la fenêtre d avant', () => {
    mockLecture = { data: undefined, isError: true, isLoading: false };
    monter();
    expect(textes()).toEqual(['fenetre-d-avant']);
  });

  it('pas visible : rien', () => {
    mockLecture = { data: TOURNOI, isLoading: false };
    monter({ visible: false });
    expect(arbre.toJSON()).toBeNull();
  });
});
