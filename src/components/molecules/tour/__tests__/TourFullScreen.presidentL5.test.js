import fs from 'fs';
import path from 'path';

import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { PRESIDENT_GUIDE } from '@/domains/tour/presidentGuide';

import { RouteNames } from '@/navigation/routeNames';

import TourFullScreen from '../TourFullScreen';

// Guide Dirigeant·e, lot L5 : ouverture, palier et clôture disent les textes du club. Les clés de
// `fr.js` arrivent à la fin du chantier ; d'ici là, et si l'une manque, le repli vient du profil,
// jamais de l'entraîneur.

let mockTour;
const mockNavigate = jest.fn(() => true);
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, fallback, values) => {
      if (typeof fallback !== 'string') return key;
      return Object.entries(values || {}).reduce(
        (text, [name, value]) => text.split(`{{${name}}}`).join(String(value)),
        fallback,
      );
    },
  }),
}));
jest.mock('@/context/useTour', () => ({ useTour: () => mockTour }));
jest.mock('@/navigation/navigationService', () => ({
  navigate: (...args) => mockNavigate(...args),
}));
jest.mock('@/domains/tour/presidentGuideSettings', () => {
  const actual = jest.requireActual('@/domains/tour/presidentGuideSettings');
  const settings = { ...actual.PRESIDENT_GUIDE_SETTINGS, enabled: true };
  return { __esModule: true, default: settings, PRESIDENT_GUIDE_SETTINGS: settings };
});
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0, left: 0, right: 0, top: 0,
  }),
}));
jest.mock('react-native-svg', () => {
  const { View } = jest.requireActual('react-native');
  /**
   * Doublure SVG : une simple vue.
   * @param {{ children?: any }} props - Enfants.
   * @returns {any} Vue.
   */
  function Box({ children }) { return <View>{children}</View>; }
  return {
    __esModule: true,
    Circle: Box,
    default: Box,
    Defs: Box,
    LinearGradient: Box,
    Rect: Box,
    Stop: Box,
  };
});

jest.mock('@/components/atoms/SvgIcon/SvgIcon', () => ({ SvgIcon: () => null }));
jest.mock('@/components/atoms/button/Button', () => {
  const { Text: RNText } = jest.requireActual('react-native');
  return { __esModule: true, default: ({ title }) => <RNText>{title}</RNText> };
});
jest.mock('@/theme/colors', () => ({ withAlpha: (color) => color }));
jest.mock('@/theme/themeContext', () => ({
  __esModule: true,
  default: () => ({
    Colors: new Proxy({}, { get: () => 'couleur' }),
    Fonts: new Proxy({}, { get: () => ({ fontSize: 16, lineHeight: 20 }) }),
  }),
}));

const ESSENTIALS = ['president_m1', 'president_m2', 'president_m3', 'president_m4'];
const allDone = Object.fromEntries(ESSENTIALS.map((id) => [id, 'done']));
const tourAt = (extras = {}) => ({
  completeCurrentStep: jest.fn(),
  created: {},
  finishGuide: jest.fn(),
  flags: { firstName: 'Sam', hasClubPlan: true },
  gauge: 100,
  missions: PRESIDENT_GUIDE.missions,
  missionStatus: allDone,
  pauseTour: jest.fn(),
  profileKey: 'president',
  ...extras,
});
const render = (kind) => {
  let tree;
  act(() => { tree = renderer.create(<TourFullScreen kind={kind} />); });
  return tree;
};
const textsOf = (kind) => {
  const flatten = (children) => (Array.isArray(children)
    ? children.map(flatten).join('')
    : String(children ?? ''));
  return render(kind).root.findAllByType(Text)
    .map((node) => flatten(node.props.children))
    .join(' | ');
};

beforeEach(() => {
  mockNavigate.mockClear();
  mockTour = tourAt();
});

describe('aucun texte du coach sur l écran du dirigeant', () => {
  const COACH = /entraîneur|séance|Équipe prête|ton lien|match d’exemple/i;

  it.each(['opening', 'milestone', 'closing'])('%s', (kind) => {
    const texts = textsOf(kind);
    expect(texts).not.toMatch(COACH);
    expect(texts).not.toMatch(/undefined|\{\{/);
  });

  it('chaque clé de l écran plein cadre a son repli dans le profil', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '..', 'TourFullScreen.js'),
      'utf8',
    );
    const keys = [...source.matchAll(/`tourCatalog\.\$\{guideKey\}\.([\w.]+)`/g)]
      .map((match) => match[1]);
    expect(keys.length).toBeGreaterThan(20);
    const missing = keys.filter((key) => !PRESIDENT_GUIDE.fullScreenTexts[key]);
    expect(missing).toEqual([]);
  });
});

describe('ouverture', () => {
  it('le pack : le club créé, 4 missions, la jauge Club prêt', () => {
    mockTour = tourAt({ gauge: 0, missionStatus: {} });
    const texts = textsOf('opening');
    expect(texts).toContain('Salut Sam, ton club est créé.');
    expect(texts).toContain('4 missions');
    expect(texts).toContain('Club prêt');
    expect(texts).toContain('Guide dirigeant·e');
    expect(texts).toContain('Inviter tes coachs');
  });
});

describe('palier : 3 états, jamais « prêt » sur rien', () => {
  it('tout est fait', () => {
    const texts = textsOf('milestone');
    expect(texts).toContain('Ton club est prêt à 100 %');
    expect(texts).not.toContain('{{');
  });

  it('une partie seulement : M1 faite, M3 refusée', () => {
    mockTour = tourAt({
      gauge: 75,
      missionStatus: { ...allDone, president_m3: 'blocked' },
    });
    const texts = textsOf('milestone');
    expect(texts).toContain('3 missions sur 4');
    expect(texts).toContain('Une partie est faite');
    expect(texts).not.toContain('prêt à 100 %');
  });

  it('rien de fait', () => {
    mockTour = tourAt({ gauge: 0, missionStatus: {} });
    expect(textsOf('milestone')).toContain('Aucune mission');
  });
});

describe('clôture', () => {
  it('le bilan ne dit que ce qui existe pour de vrai', () => {
    expect(PRESIDENT_GUIDE.closingLines((_key, fallback) => fallback, { created: {}, flags: {} }))
      .toEqual([]);
    mockTour = tourAt({
      created: {
        'club.poster.shared': {},
        'club.updated': {},
        'facility.created': {},
        'sponsor.created': {},
        'staff.invited': {},
        'team.created': { teamName: 'Seniors' },
      },
    });
    const texts = textsOf('closing');
    ['Infos du club', 'Partenaire', 'Installation', 'Affiche', 'Coach ajouté', 'Seniors']
      .forEach((line) => expect(texts).toContain(line));
    expect(texts).toContain('Ton club est prêt');
    expect(texts).toContain('Bonne saison');
    expect(texts).toContain('Mon compte');
  });

  // Décision 5 d'Adel : coach et partenaire se passent, et la jauge va à 100 %. Le bilan dit ce
  // qui reste à faire (tri du chef, 05/11).
  it('coach et partenaire passés : le bilan dit ce qui reste à faire', () => {
    mockTour = tourAt({ skippedSubMissions: ['coach', 'partners'] });
    const texts = textsOf('closing');
    expect(texts).toContain('À faire : ton coach');
    expect(texts).toContain('À faire : ton partenaire');
  });

  it('témoin : rien de passé, aucune ligne « à faire »', () => {
    mockTour = tourAt({ skippedSubMissions: [] });
    expect(textsOf('closing')).not.toContain('À faire');
  });

  it('coach rattaché au lieu de créé : dit aussi, une seule fois', () => {
    const lines = PRESIDENT_GUIDE.closingLines(
      (_key, fallback) => fallback,
      { created: { 'staff.linked': {} }, flags: {} },
    );
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/Coach/);
  });

  it('l exemple de M4 : la clôture dit qu il n a rien laissé', () => {
    expect(textsOf('closing')).toContain('rien n’a été envoyé');
    mockTour = tourAt({ missionStatus: {} });
    expect(textsOf('closing')).not.toContain('rien n’a été envoyé');
  });

  it('titre partiel si une mission manque', () => {
    mockTour = tourAt({ missionStatus: { ...allDone, president_m3: 'blocked' } });
    expect(textsOf('closing')).toContain('Le guide est fini');
  });

  it('avec le droit ouvert, pas d offre ; le bouton va à l accueil', () => {
    const tree = render('closing');
    expect(textsOf('closing')).not.toContain('Voir l’offre Club');
    const home = tree.root.findAll((node) => node.props?.title === "Aller à l'accueil")[0];
    act(() => home.props.onPress());
    expect(mockTour.finishGuide).toHaveBeenCalledTimes(1);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('sans droit ouvert (décision 1) : l achat proposé en fin de guide, sans le forcer', () => {
    mockTour = tourAt({ flags: { hasClubPlan: false } });
    const tree = render('closing');
    const offer = tree.root.findAll(
      (node) => node.props?.accessibilityRole === 'button' && node.props?.onPress
        && node.findAllByType(Text).some((text) => text.props.children === 'Voir l’offre Club'),
    )[0];
    expect(offer).toBeDefined();
    act(() => offer.props.onPress());
    expect(mockTour.finishGuide).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith(RouteNames.GuideOffersRecap);
  });
});

describe('le guide se termine sur le palier puis la clôture', () => {
  it('dans l ordre, après M4', () => {
    const ids = PRESIDENT_GUIDE.steps.map((step) => step.id);
    expect(ids.indexOf('palier')).toBeGreaterThan(ids.indexOf('m4-accept'));
    expect(ids[ids.length - 1]).toBe('close');
    expect(PRESIDENT_GUIDE.exampleMissionId).toBe('president_m4');
  });
});
