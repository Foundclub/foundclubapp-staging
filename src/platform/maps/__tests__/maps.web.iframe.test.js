import renderer, { act } from 'react-test-renderer';

import { renderMap } from '@/platform/maps/maps.web';

// RESA-CARTE (20/10/2026) — LA CARTE DU SITE (Leaflet dans une iframe) NE SE RECHARGE PLUS À CHAQUE
// ÉTAT. Mesuré le 20/10 au navigateur (témoin web tests/components/resa-carte.spec.ts) : la page de
// l'iframe (`srcDoc`) était reconstruite à chaque changement d'état (repères, repère choisi,
// cadrage) ⇒ l'iframe se rechargeait (5 fois en quelques secondes), la carte clignotait, et une
// épingle touchée pendant un rechargement était PERDUE. Or la page reçoit déjà chaque nouvel état
// par message (SYNC_STATE, searchMapRuntime.js) : elle n'a besoin d'être construite qu'une fois.
// Fichier sans témoin (E6) : les deux premiers témoins décrivent ce qui reste (la page de départ
// porte les repères ; l'état part par message une fois la page chargée) ; les trois suivants, les
// règles neuves (rouges avant) : une page chargée pendant le montage n'est pas oubliée ; sans clé
// TomTom (le site n'en a aucune), l'état part quand même ; un nouvel état ne recharge pas la page.
// Appelants (R2) : SearchMap.web.js (annuaire du site, recherche de terrains)
// et renderPinMap (LieuSurCarte, « placer sur la carte ») — les témoins web lieu-sur-carte et
// r17-adresse-carte couvrent ce second chemin dans la porte du site.

jest.mock('@/platform/maps/searchMapGeolocation', () => ({
  readCurrentSearchMapLocationIfGranted: async () => null,
}));
jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));

const repere = (/** @type {string} */ id, /** @type {number} */ lat) => ({
  badge: '',
  dateLabel: '',
  distanceLabel: '',
  id,
  imageUrl: '',
  lat,
  lng: 2.35,
  priceLabel: '',
  raw: {},
  subtitle: '',
  timeLabel: '',
  title: id,
  type: 'clubs',
});

/**
 * La carte du site, montée telle que SearchMap.web.js l'appelle.
 * @param {any} props - Les propriétés de `renderMap`.
 * @returns {import('react').ReactElement} La carte.
 */
function Carte(props) {
  return renderMap(props);
}

const messages = /** @type {any[]} */ ([]);
const fenetre = { postMessage: (/** @type {any} */ message) => messages.push(message) };

/**
 * Monte la carte ; l'iframe reçoit une fausse fenêtre qui garde les messages.
 * @param {{ items: any[], scope: string }} props - Les repères et la portée.
 * @returns {Promise<any>} L'arbre.
 */
const monter = async (props) => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<Carte items={props.items} scope={props.scope} />, {
      createNodeMock: (element) => (element.type === 'iframe' ? { contentWindow: fenetre } : null),
    });
  });
  return arbre;
};

const iframe = (/** @type {any} */ arbre) => arbre.root.findByType('iframe');

// L'environnement jest de React Native n'a pas les écouteurs d'une fenêtre de navigateur : la
// carte du site écoute les messages de sa page Leaflet. Ajoutés le temps du témoin, s'ils manquent.
const AJOUTES = /** @type {string[]} */ ([]);

beforeAll(() => {
  // Les tuiles OpenStreetMap (sans clé TomTom) : la carte est la même.
  Reflect.set(global, 'fcSearchMapTestOverrides', { FC_SEARCH_MAP_PROVIDER: 'legacy' });
  ['addEventListener', 'removeEventListener'].forEach((nom) => {
    if (typeof Reflect.get(window, nom) !== 'function') {
      Reflect.set(window, nom, () => {});
      AJOUTES.push(nom);
    }
  });
});

afterAll(() => {
  Reflect.deleteProperty(global, 'fcSearchMapTestOverrides');
  AJOUTES.forEach((nom) => Reflect.deleteProperty(window, nom));
});

beforeEach(() => {
  messages.length = 0;
});

describe('RESA-CARTE — la carte du site, une page Leaflet par carte', () => {
  it('la page de départ porte les repères', async () => {
    const arbre = await monter({ items: [repere('repere-1', 48.85)], scope: 'clubs' });
    expect(iframe(arbre).props.srcDoc).toContain('repere-1');
    expect(iframe(arbre).props.title).toBe('FoundClub map');
  });

  it('page chargée : l’état courant part par message (SYNC_STATE)', async () => {
    const arbre = await monter({ items: [repere('repere-1', 48.85)], scope: 'clubs' });
    await act(async () => {
      iframe(arbre).props.onLoad();
    });
    const dernier = messages[messages.length - 1];
    expect(dernier).toEqual(expect.objectContaining({ type: 'SYNC_STATE' }));
    expect(dernier.payload.items.map((/** @type {any} */ item) => item.id)).toEqual(['repere-1']);
  });

  it('une page chargée AVANT les effets du montage n’est pas oubliée (l’état part)', async () => {
    // Une page `srcdoc` se charge vite : son événement peut arriver pendant le montage, avant les
    // effets. Simulé ici : l'iframe se dit chargée au moment même où elle reçoit sa référence.
    await act(async () => {
      renderer.create(<Carte items={[repere('repere-1', 48.85)]} scope="clubs" />, {
        createNodeMock: (element) => {
          if (element.type !== 'iframe') return null;
          element.props.onLoad();
          return { contentWindow: fenetre };
        },
      });
    });
    const dernier = messages[messages.length - 1];
    expect(dernier).toEqual(expect.objectContaining({ type: 'SYNC_STATE' }));
  });

  it('sans clé TomTom (le site) : l’état part quand même (OpenStreetMap)', async () => {
    Reflect.set(global, 'fcSearchMapTestOverrides', {
      FC_SEARCH_MAP_PROVIDER: 'tomtom', TOMTOM_API_KEY: '',
    });
    try {
      const arbre = await monter({ items: [repere('repere-1', 48.85)], scope: 'clubs' });
      expect(iframe(arbre).props.srcDoc).toContain('tile.openstreetmap.org');
      await act(async () => {
        iframe(arbre).props.onLoad();
      });
      const dernier = messages[messages.length - 1];
      expect(dernier).toEqual(expect.objectContaining({ type: 'SYNC_STATE' }));
    } finally {
      Reflect.set(global, 'fcSearchMapTestOverrides', { FC_SEARCH_MAP_PROVIDER: 'legacy' });
    }
  });

  it('un nouvel état ne reconstruit PAS la page : il part par message', async () => {
    const arbre = await monter({ items: [repere('repere-1', 48.85)], scope: 'clubs' });
    await act(async () => {
      iframe(arbre).props.onLoad();
    });
    const page = iframe(arbre).props.srcDoc;
    await act(async () => {
      arbre.update(<Carte
        items={[repere('repere-1', 48.85), repere('repere-2', 48.9)]}
        scope="clubs"
        selectedItemId="repere-2"
      />);
    });
    expect(iframe(arbre).props.srcDoc).toBe(page);
    const dernier = messages[messages.length - 1];
    expect(dernier.payload.selectedItemId).toBe('repere-2');
    expect(dernier.payload.items.map((/** @type {any} */ item) => item.id))
      .toEqual(['repere-1', 'repere-2']);
  });
});
