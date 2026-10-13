import { createElement } from 'react';
import {
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import renderer, { act } from 'react-test-renderer';

// Le vrai i18next en français : les libellés viennent de fr.js, pas des replis.
import '@/theme/strings';
import { mapClubInterestRequestToHubItem } from '@/domains/requests/requestMappers';

import Button from '@/components/atoms/button/Button';

import RequestFeedItem from '../RequestFeedItem';

// ─────────────────────────────────────────────────────────────────────────────
// 👪 PAR-L2L3 (12/10) — LES DEUX CARTES D'INTÉRÊT, côté club. Recette parent
// d'Adel sur iPhone (11/10), fiches PAR-008 et PAR-007 ; design du 12/10, écrans
// E15 et E14 (planche 6). GO d'Adel du 12/10 : « lots go ».
//
// L2 (PAR-008) — sur la carte d'intérêt d'un ADULTE, « Ouvrir chat » et
//   « Répondre » tombaient à ~4 points : côte à côte, chaque libellé n'avait
//   qu'environ 84 points et le rétrécissement automatique d'iOS descend sous son
//   plancher. Les boutons s'EMPILENT, en pleine largeur, à la hauteur de
//   « Voir le profil ». ⛔ Leur ORDRE et leurs libellés appartiennent au lot L9a.
//
// L3 (PAR-007) — sur une demande de place pour un ENFANT, l'encadrement doit
//   reconnaître l'enfant : son prénom et son âge en titre, son initiale (jamais
//   de photo), la pastille « Place enfant » ; le parent passe en second, avec
//   « Profil du parent ». Prénom et âge SEULEMENT avant l'acceptation : c'est la
//   minimisation des données d'un mineur (montrer plus = décision d'Adel).
//   Refuser / Accepter ne changent pas.
//
// Le chemin est celui de l'app : demande brute → VRAI mappeur → VRAIE carte.
// ─────────────────────────────────────────────────────────────────────────────

jest.mock('@/theme/themeContext', () => {
  const colors = jest.requireActual('@/theme/colors').default();
  return {
    __esModule: true,
    default: () => ({
      Alignments: jest.requireActual('@/theme/alignements').default,
      ApplicationStyle: jest.requireActual('@/theme/applicationStyle').default(colors),
      Colors: colors,
      Fonts: jest.requireActual('@/theme/fonts').default(colors),
      Images: { check: 1, close: 2 },
      Spaces: jest.requireActual('@/theme/spaces').default,
    }),
  };
});

// Composant hôte : ses props se lisent dans l'arbre.
jest.mock('@/components/molecules/profileAvatar/ProfileAvatar', () => 'ProfileAvatar');

/**
 * Le texte d'un noeud `Text`, enfants imbriqués compris.
 * @param {any} noeud Le noeud.
 * @returns {string} Le texte.
 */
const texteDe = (noeud) => {
  /**
   * Lit un enfant, quelle que soit sa forme.
   * @param {any} enfant Un enfant du noeud.
   * @returns {string} Son texte.
   */
  const lire = (enfant) => {
    if (enfant === null || enfant === undefined || typeof enfant === 'boolean') return '';
    if (typeof enfant === 'string' || typeof enfant === 'number') return String(enfant);
    if (Array.isArray(enfant)) return enfant.map(lire).join('');
    return lire(enfant?.props?.children);
  };
  return lire(noeud.props.children);
};

/**
 * Les ancêtres d'un noeud d'un type donné, du plus proche au plus lointain.
 * @param {any} noeud Le point de départ.
 * @param {any} type Le type cherché.
 * @returns {any[]} Les ancêtres.
 */
const ancetres = (noeud, type) => {
  const trouves = [];
  let courant = noeud?.parent;
  while (courant) {
    if (courant.type === type) trouves.push(courant);
    courant = courant.parent;
  }
  return trouves;
};

/**
 * Monte la carte d'une demande telle que l'app la construit.
 * @param {any} demande La demande brute, comme le serveur la rend.
 * @param {Record<string, any>} [rappels] Les fonctions passées à la carte.
 * @returns {any} Ce que l'écran montre.
 */
const monter = (demande, rappels = {}) => {
  const item = mapClubInterestRequestToHubItem(demande);
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(createElement(RequestFeedItem, {
      item,
      onPrimaryPress: jest.fn(),
      onRequesterPress: jest.fn(),
      onSecondaryPress: jest.fn(),
      ...rappels,
    }));
  });
  const boutons = arbre.root.findAllByType(Button);
  return {
    arbre,
    avatars: arbre.root.findAll((/** @type {any} */ n) => n.type === 'ProfileAvatar'),
    bouton: (/** @type {string} */ titre) => boutons.find((b) => b.props.title === titre),
    boutons,
    item,
    textes: arbre.root.findAllByType(Text).map(texteDe),
    titres: boutons.map((b) => b.props.title),
  };
};

const PARENT = {
  avatar: { url: '/uploads/maryline.jpg' },
  documentId: 'parent-1',
  firstname: 'Maryline',
  lastname: 'Monroe',
};

const PLACE_POUR_ANISSA = {
  club: { documentId: 'club-1', name: 'FoundClub' },
  createdAt: '2026-10-11T08:30:00.000Z',
  // `lastname` ne vient pas du serveur aujourd'hui (toStaffChildView) : il est
  // posé ici pour prouver que la carte ne montrerait pas plus qu'il ne faut.
  declaredChild: {
    age: 11, documentId: 'enfant-anissa', firstname: 'Anissa', lastname: 'Dubelloy',
  },
  documentId: 'interest-anissa',
  status: 'pending',
  team: { documentId: 'team-u11f', name: 'U11 Filles' },
  user: PARENT,
};

const INTERET_ADULTE = {
  club: { documentId: 'club-1', name: 'FoundClub' },
  createdAt: '2026-10-11T08:39:00.000Z',
  documentId: 'interest-adulte',
  status: 'pending',
  team: { documentId: 'team-u11f', name: 'U11 Filles' },
  user: PARENT,
};

describe('PAR-L2L3 · L3 — une demande de place parle de l ENFANT', () => {
  test('le titre est l enfant, la pastille « Place enfant », le parent en second', () => {
    const carte = monter(PLACE_POUR_ANISSA);

    expect(carte.textes.slice(0, 2)).toEqual(['Anissa, 11 ans', 'Place enfant']);
    expect(carte.textes).toContain('Demande une place dans U11 Filles.');
    expect(carte.textes).toContain('Parent : Maryline Monroe');
    act(() => carte.arbre.unmount());
  });

  test('l initiale de l enfant, jamais une photo — ni la sienne, ni celle du parent', () => {
    const carte = monter(PLACE_POUR_ANISSA);

    expect(carte.avatars).toHaveLength(1);
    expect(carte.avatars[0].props).toMatchObject({ imageUrl: '', name: 'Anissa' });
    act(() => carte.arbre.unmount());
  });

  test('prénom et âge SEULEMENT : aucun nom de famille de l enfant à l écran', () => {
    const carte = monter(PLACE_POUR_ANISSA);

    carte.textes.forEach((/** @type {string} */ texte) => expect(texte).not.toContain('Dubelloy'));
    act(() => carte.arbre.unmount());
  });

  test('« Profil du parent » ouvre le parent ; la ligne de l enfant ne mène pas au parent', () => {
    const surProfil = jest.fn();
    const carte = monter(PLACE_POUR_ANISSA, { onRequesterPress: surProfil });

    expect(carte.titres).toEqual(['Profil du parent', 'Refuser', 'Accepter']);
    const profil = carte.bouton('Profil du parent');
    expect(profil.props.accessibilityLabel).toBe('Profil du parent');
    expect(profil.props.accessibilityHint).toBe('Ouvre le profil du parent');
    act(() => profil.findByType(TouchableOpacity).props.onPress());
    expect(surProfil).toHaveBeenCalledTimes(1);
    expect(surProfil.mock.calls[0][0].meta.requesterId).toBe('parent-1');

    // L'initiale est celle de l'enfant : la toucher n'ouvre pas le profil d'un adulte.
    expect(ancetres(carte.avatars[0], TouchableOpacity)).toHaveLength(0);
    act(() => carte.arbre.unmount());
  });

  test('Refuser / Accepter ne changent pas : côte à côte, avec leur icône', () => {
    const carte = monter(PLACE_POUR_ANISSA);

    ['Refuser', 'Accepter'].forEach((titre) => {
      const bouton = carte.bouton(titre);
      expect(bouton.props.isOption).toBe(true);
      expect(StyleSheet.flatten(ancetres(bouton, View)[0].props.style)).toMatchObject({ flex: 1 });
      expect(StyleSheet.flatten(ancetres(bouton, View)[1].props.style))
        .toMatchObject({ flexDirection: 'row' });
    });
    expect(carte.bouton('Refuser').props.icon).toBe('close');
    expect(carte.bouton('Accepter').props.icon).toBe('check');
    act(() => carte.arbre.unmount());
  });

  test('âge inconnu : le prénom seul, sans virgule ni « ans »', () => {
    const carte = monter({
      ...PLACE_POUR_ANISSA,
      declaredChild: { age: null, documentId: 'enfant-anissa', firstname: 'Anissa' },
    });

    expect(carte.textes[0]).toBe('Anissa');
    act(() => carte.arbre.unmount());
  });

  test('deux enfants d un même parent, même équipe : deux cartes, chacune son prénom', () => {
    const anissa = monter(PLACE_POUR_ANISSA);
    const martin = monter({
      ...PLACE_POUR_ANISSA,
      declaredChild: { age: 9, documentId: 'enfant-martin', firstname: 'Martin' },
      documentId: 'interest-martin',
    });

    expect(anissa.item.id).not.toBe(martin.item.id);
    expect(anissa.textes[0]).toBe('Anissa, 11 ans');
    expect(martin.textes[0]).toBe('Martin, 9 ans');
    expect(anissa.avatars[0].props.name).toBe('Anissa');
    expect(martin.avatars[0].props.name).toBe('Martin');
    act(() => anissa.arbre.unmount());
    act(() => martin.arbre.unmount());
  });
});

describe('PAR-L2L3 · L2 — la carte d intérêt d un ADULTE, boutons lisibles', () => {
  test('l adulte reste l adulte : son nom, sa photo, la pastille « Intérêt »', () => {
    const carte = monter(INTERET_ADULTE);

    expect(carte.textes[1]).toBe('Intérêt');
    expect(carte.avatars).toHaveLength(1);
    expect(carte.avatars[0].props).toMatchObject({
      imageUrl: '/uploads/maryline.jpg', name: 'Maryline Monroe',
    });
    expect(carte.titres).toContain('Voir le profil');
    expect(carte.titres).not.toContain('Profil du parent');
    expect(carte.textes).not.toContain('Place enfant');
    act(() => carte.arbre.unmount());
  });

  test('« Équipe visée : U11 Filles » — accent et espace avant les deux-points', () => {
    const carte = monter(INTERET_ADULTE);

    expect(carte.textes).toContain('Équipe visée : U11 Filles');
    act(() => carte.arbre.unmount());
  });

  test('l ordre des boutons ne change pas (il appartient au lot L9a)', () => {
    const carte = monter(INTERET_ADULTE);

    expect(carte.titres).toEqual(['Voir le profil', 'Ouvrir chat', 'Répondre']);
    act(() => carte.arbre.unmount());
  });

  test('« Ouvrir chat » et « Répondre » sont EMPILÉS, en pleine largeur', () => {
    const carte = monter(INTERET_ADULTE);

    ['Ouvrir chat', 'Répondre'].forEach((titre) => {
      const bouton = carte.bouton(titre);
      // Aucun étage entre le bouton et la carte ne le met en rangée, ne le
      // partage avec un voisin, ni ne le resserre sur son contenu.
      ancetres(bouton, View).forEach((vue) => {
        const style = StyleSheet.flatten(vue.props.style) || {};
        expect(style.flexDirection).not.toBe('row');
        expect(style.flex).toBeUndefined();
        expect(['center', 'flex-start', 'flex-end']).not.toContain(style.alignItems);
      });
      const surface = StyleSheet.flatten(bouton.findByType(TouchableOpacity).props.style);
      expect(surface.width).toBeUndefined();
    });
    act(() => carte.arbre.unmount());
  });

  test('les trois boutons ont la même hauteur que « Voir le profil » (≥ 44 points)', () => {
    const carte = monter(INTERET_ADULTE);

    const hauteurs = ['Voir le profil', 'Ouvrir chat', 'Répondre'].map((titre) => (
      StyleSheet.flatten(carte.bouton(titre).findByType(TouchableOpacity).props.style).height
    ));
    expect(new Set(hauteurs).size).toBe(1);
    expect(hauteurs[0]).toBeGreaterThanOrEqual(44);
    act(() => carte.arbre.unmount());
  });

  test('chaque bouton garde son geste : profil, conversation, réponse', () => {
    const surProfil = jest.fn();
    const surPrincipal = jest.fn();
    const surSecondaire = jest.fn();
    const carte = monter(INTERET_ADULTE, {
      onPrimaryPress: surPrincipal, onRequesterPress: surProfil, onSecondaryPress: surSecondaire,
    });

    act(() => carte.bouton('Voir le profil').findByType(TouchableOpacity).props.onPress());
    act(() => carte.bouton('Ouvrir chat').findByType(TouchableOpacity).props.onPress());
    act(() => carte.bouton('Répondre').findByType(TouchableOpacity).props.onPress());
    expect(surProfil).toHaveBeenCalledWith(carte.item);
    expect(surSecondaire).toHaveBeenCalledWith(carte.item);
    expect(surPrincipal).toHaveBeenCalledWith(carte.item);
    act(() => carte.arbre.unmount());
  });
});
