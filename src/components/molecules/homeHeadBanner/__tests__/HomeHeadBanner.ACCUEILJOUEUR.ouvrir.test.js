import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import HomeHeadBanner from '../HomeHeadBanner';

// ACCUEIL-JOUEUR (09/11/2026, retour d'un vrai joueur relayé par Adel) — LA CARTE « MA SEMAINE »
// S'OUVRE. On pouvait répondre Présent / Absent, mais pas ouvrir l'événement. Toucher la carte,
// hors des deux boutons, ouvre sa fiche (`onOpen`) ; les boutons gardent leur rôle, et un toucher
// sur un bouton n'ouvre pas la fiche : la zone touchable ne les CONTIENT pas (sur le site, un clic
// sur un bouton imbriqué remonterait jusqu'à elle). Rôle bouton, libellé « Voir l'événement ».
// Écrit ROUGE : `onOpen` n'existait pas.

jest.mock('@/theme/themeContext', () => {
  const { colors: vraiesCouleurs } = jest.requireActual('@/theme/colors');
  const styleLeaf = {};
  const makeRamp = () => new Proxy({}, { get: () => styleLeaf });
  return {
    __esModule: true,
    default: () => ({
      Alignments: makeRamp(),
      ApplicationStyle: new Proxy({}, { get: () => makeRamp() }),
      Colors: vraiesCouleurs,
      Fonts: makeRamp(),
      Images: new Proxy({}, { get: () => 'image' }),
      Spaces: new Proxy({}, { get: () => makeRamp() }),
    }),
  };
});

jest.mock('@/components/atoms/button/Button', () => {
  const { Text: RNText } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ onPress, title }) => <RNText onPress={onPress}>{title}</RNText>,
  };
});

/**
 * Monte la carte d'un joueur qui peut répondre.
 * @returns {Promise<{ arbre: any, onAbsent: jest.Mock, onOpen: jest.Mock, onPresent: jest.Mock }>}
 */
const monter = async () => {
  const onOpen = jest.fn();
  const onPresent = jest.fn();
  const onAbsent = jest.fn();
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <HomeHeadBanner
        actions={[
          { key: 'present', label: 'Présent', onPress: onPresent },
          { key: 'absent', label: 'Absent', onPress: onAbsent },
        ]}
        label="Ma semaine"
        onOpen={onOpen}
        openLabel="Voir l’événement"
        subtitle="Match vs Équipe B"
        title="Lundi 9 · 19:00"
        titleSuffix="Je participe !"
        variant="event"
      />,
    );
  });
  return {
    arbre, onAbsent, onOpen, onPresent,
  };
};

const zoneOuvrir = (/** @type {any} */ arbre) => arbre.root.findAll(
  (/** @type {any} */ noeud) => typeof noeud.type === 'string'
    && noeud.props.testID === 'home-head-banner-open',
);

const textesDe = (/** @type {any} */ noeud) => noeud.findAllByType(Text)
  .map((/** @type {any} */ t) => [].concat(t.props.children).join(''));

describe('ACCUEIL-JOUEUR — toucher la carte « Ma semaine » ouvre l événement', () => {
  test('toucher sur la carte : la fiche s ouvre', async () => {
    const { arbre, onOpen, onPresent } = await monter();
    const zones = zoneOuvrir(arbre);
    expect(zones).toHaveLength(1);
    expect(textesDe(zones[0]).join(' ')).toContain('Lundi 9 · 19:00');
    await act(async () => { zones[0].props.onClick(); });
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onPresent).not.toHaveBeenCalled();
  });

  test('toucher sur Présent : la réponse part, la fiche ne s ouvre pas', async () => {
    const { arbre, onOpen, onPresent } = await monter();
    const present = arbre.root.findAllByType(Text)
      .find((/** @type {any} */ t) => t.props.children === 'Présent');
    await act(async () => { present.props.onPress(); });
    expect(onPresent).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
    // Les boutons ne sont PAS dans la zone qui ouvre (sur le site, le clic remonterait).
    expect(textesDe(zoneOuvrir(arbre)[0])).not.toEqual(expect.arrayContaining(['Présent']));
    expect(textesDe(zoneOuvrir(arbre)[0])).not.toEqual(expect.arrayContaining(['Absent']));
  });

  test('accessibilité : rôle bouton, libellé « Voir l’événement »', async () => {
    const { arbre } = await monter();
    const [zone] = zoneOuvrir(arbre);
    expect(zone.props.accessibilityRole ?? zone.props.role).toBe('button');
    expect(zone.props.accessibilityLabel ?? zone.props['aria-label']).toBe('Voir l’événement');
  });

  test('sans `onOpen` (les autres cartes), rien ne change : pas de zone touchable', async () => {
    /** @type {any} */
    let arbre;
    await act(async () => {
      arbre = renderer.create(
        <HomeHeadBanner label="Ma semaine" title="Lundi 9 · 19:00" variant="event" />,
      );
    });
    expect(zoneOuvrir(arbre)).toHaveLength(0);
  });
});
