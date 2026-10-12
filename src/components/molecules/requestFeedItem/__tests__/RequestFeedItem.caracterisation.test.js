import { createElement } from 'react';
import {
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import renderer, { act } from 'react-test-renderer';

// Le vrai i18next en français : les libellés viennent de fr.js, pas des replis.
import '@/theme/strings';

import Button from '@/components/atoms/button/Button';

import RequestFeedItem from '../RequestFeedItem';

// ─────────────────────────────────────────────────────────────────────────────
// 📸 PAR-L2L3 (12/10) — TÉMOIN CARACTÉRISANT de la carte de demande (règle E6).
//
// `RequestFeedItem` n'avait aucun test à lui : un seul témoin (IPH09) la montait,
// pour la carte d'adhésion. Ce fichier décrit ce que la carte affiche AUJOURD'HUI
// pour chaque type de demande, AVANT que PAR-L2L3 ne touche aux deux cartes
// d'intérêt. Il doit rester vert après le lot : la pile de boutons (L2) et
// l'enfant au premier plan (L3) ne concernent QUE les cartes d'intérêt.
// Ce qui DOIT changer est dans RequestFeedItem.PAR-L2L3.test.js.
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

// Composants hôtes : leurs props se lisent dans l'arbre, sans moteur de mise en page.
jest.mock('@/components/molecules/profileAvatar/ProfileAvatar', () => 'ProfileAvatar');
jest.mock('@/components/atoms/marqueeText/MarqueeText', () => 'MarqueeText');

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
 * Le premier ancêtre d'un type donné (une vue de test a deux étages : le
 * composant et son hôte).
 * @param {any} noeud Le point de départ.
 * @param {any} type Le type cherché.
 * @returns {any} L'ancêtre, ou null.
 */
const ancetre = (noeud, type) => {
  let courant = noeud?.parent;
  while (courant && courant.type !== type) courant = courant.parent;
  return courant || null;
};

/**
 * Monte la carte et la rend lisible : textes, boutons, disposition des actions.
 * @param {any} item La demande.
 * @param {Record<string, any>} [rappels] Les fonctions passées à la carte.
 * @returns {any} Ce que l'écran montre.
 */
const monter = (item, rappels = {}) => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(createElement(RequestFeedItem, { item, ...rappels }));
  });
  const boutons = arbre.root.findAllByType(Button);
  const boutonsAction = boutons.filter((/** @type {any} */ bouton) => bouton.props.isOption);
  const rangee = boutonsAction.length
    ? ancetre(ancetre(boutonsAction[0], View), View)
    : null;
  return {
    arbre,
    avatars: arbre.root.findAll((/** @type {any} */ n) => n.type === 'ProfileAvatar'),
    boutons: boutons.map((/** @type {any} */ bouton) => ({
      icone: bouton.props.icon,
      option: Boolean(bouton.props.isOption),
      titre: bouton.props.title,
      variante: bouton.props.variant,
    })),
    boutonsAction,
    rangee: rangee ? StyleSheet.flatten(rangee.props.style) : null,
    textes: arbre.root.findAllByType(Text).map(texteDe),
  };
};

/**
 * Les deux boutons d'action sont côte à côte, à parts égales.
 * @param {any} carte La carte montée.
 */
const attendreCoteACote = (carte) => {
  expect(carte.rangee).toMatchObject({ flexDirection: 'row' });
  carte.boutonsAction.forEach((/** @type {any} */ bouton) => {
    expect(StyleSheet.flatten(ancetre(bouton, View).props.style)).toMatchObject({ flex: 1 });
  });
};

const ADHESION_EQUIPE = {
  actions: { primary: 'accept', secondary: 'reject' },
  id: 'team:req-1',
  meta: { requesterAvatarUrl: '/a.jpg', requesterId: 'u-1', requesterName: 'Léo Martin' },
  subtitle: 'Léo Martin souhaite rejoindre Senior.',
  title: 'Demande adhésion équipe',
  type: 'team',
};

const ADHESION_CLUB = {
  ...ADHESION_EQUIPE,
  id: 'club:req-2',
  subtitle: 'Léo Martin souhaite rejoindre FC Test.',
  title: 'Demande adhésion club',
  type: 'club',
};

const PARTICIPATION = {
  actions: { primary: 'validate', secondary: 'reject' },
  id: 'event:ev-1:participation:p-1',
  meta: {
    eventId: 'ev-1',
    requesterId: 'u-2',
    requesterName: 'Nina Roux',
    sourceTeamName: 'U20',
  },
  subtitle: 'Détection - Senior 2',
  title: 'Validation événement',
  type: 'event',
};

const VALIDATION_EVENEMENT = {
  actions: { primary: 'validate', secondary: 'reject' },
  id: 'event:ev-2',
  meta: { eventId: 'ev-2' },
  subtitle: 'Match - Senior 2',
  title: 'Validation événement',
  type: 'event',
};

const INVITATION = {
  actions: {},
  id: 'teamInvite:aud-1',
  meta: { eventDate: '2026-11-04T18:00:00.000Z', eventId: 'ev-3' },
  subtitle: 'FC Voisin invite Senior à son tournoi.',
  title: 'Invitation à un événement',
  type: 'teamInvite',
};

const INSTALLATION = {
  actions: { primary: 'accept', secondary: 'reject' },
  id: 'installation:f-1',
  meta: {
    facilityName: 'Gymnase Nord',
    maxSlots: 2,
    overlapCount: 2,
    teamName: 'U13',
    windowEnd: '2026-11-04T20:00:00.000Z',
    windowStart: '2026-11-04T18:00:00.000Z',
  },
  subtitle: 'U13 demande une place supplémentaire.',
  title: 'Dépassement de créneau',
  type: 'installation',
};

const A_LA_UNE = {
  actions: { primary: 'accept', secondary: 'reject' },
  id: 'featured:ev-4',
  meta: { scopeLabel: 'Club' },
  subtitle: 'Tournoi de printemps demande la une du club.',
  title: 'À la une : Tournoi de printemps',
  type: 'featured',
};

const AMICAL = {
  actions: { primary: 'open' },
  id: 'friendly:ad-1:app-1',
  meta: {},
  subtitle: 'FC Voisin propose un match à Senior.',
  title: 'Proposition de match amical',
  type: 'friendly',
};

const INTERET_ADULTE = {
  actions: { primary: 'respond', secondary: 'chat' },
  id: 'interest:i-1',
  meta: {
    requesterAvatarUrl: '/maryline.jpg',
    requesterId: 'u-parent',
    requesterName: 'Maryline Monroe',
    requestId: 'i-1',
    teamName: 'U11 Filles',
  },
  subtitle: 'Maryline Monroe est intéressé par U11 Filles.',
  title: 'Intérêt club',
  type: 'interest',
};

describe('PAR-L2L3 — la carte de demande, ce qui ne bouge pas', () => {
  test.each([
    ['team', ADHESION_EQUIPE, 'Équipe'],
    ['club', ADHESION_CLUB, 'Club'],
  ])('adhésion %s : avatar, profil, Refuser / Accepter côte à côte', (_type, item, pastille) => {
    const carte = monter(item, {
      onPrimaryPress: jest.fn(), onRequesterPress: jest.fn(), onSecondaryPress: jest.fn(),
    });

    expect(carte.textes.slice(0, 3)).toEqual([item.title, pastille, item.subtitle]);
    expect(carte.avatars).toHaveLength(1);
    expect(carte.avatars[0].props).toMatchObject({ imageUrl: '/a.jpg', name: 'Léo Martin' });
    expect(carte.boutons).toEqual([
      {
        icone: undefined, option: false, titre: 'Voir le profil', variante: 'Secondary',
      },
      {
        icone: 'close', option: true, titre: 'Refuser', variante: 'Secondary',
      },
      {
        icone: 'check', option: true, titre: 'Accepter', variante: 'Primary',
      },
    ]);
    attendreCoteACote(carte);
    act(() => carte.arbre.unmount());
  });

  test('participation : nom du demandeur, équipe d origine, puis Refuser / Valider', () => {
    const carte = monter(PARTICIPATION, {
      onEventPress: jest.fn(),
      onPrimaryPress: jest.fn(),
      onRequesterPress: jest.fn(),
      onSecondaryPress: jest.fn(),
    });

    expect(carte.textes).toEqual(expect.arrayContaining([
      'Validation événement', 'Événement', 'Nina Roux', 'Détection - Senior 2',
    ]));
    const marquee = carte.arbre.root.findAll((/** @type {any} */ n) => n.type === 'MarqueeText');
    expect(marquee[0].props.text).toBe('U20');
    expect(carte.boutons.map((/** @type {any} */ b) => b.titre))
      .toEqual(['Voir le profil', "Voir l'événement", 'Refuser', 'Valider']);
    attendreCoteACote(carte);
    act(() => carte.arbre.unmount());
  });

  test('validation sans demandeur : « Utilisateur » en avatar, sans profil (constaté)', () => {
    const carte = monter(VALIDATION_EVENEMENT, {
      onEventPress: jest.fn(), onPrimaryPress: jest.fn(), onSecondaryPress: jest.fn(),
    });

    // ⚠️ CONSTATÉ le 12/10, hors du lot : le repli « Utilisateur » du nom rend
    // `isEventParticipationRequest` toujours vrai pour un événement. Décrit tel
    // quel, signalé au chef d'orchestre ; PAR-L2L3 n'y touche pas.
    expect(carte.textes.slice(0, 4)).toEqual([
      'Validation événement', 'Événement', 'Utilisateur', 'Match - Senior 2',
    ]);
    expect(carte.avatars).toHaveLength(1);
    expect(carte.avatars[0].props).toMatchObject({ imageUrl: '', name: 'Utilisateur' });
    expect(carte.boutons.map((/** @type {any} */ b) => b.titre))
      .toEqual(["Voir l'événement", 'Refuser', 'Valider']);
    attendreCoteACote(carte);
    act(() => carte.arbre.unmount());
  });

  test('invitation d équipe : la phrase, une date, et « Répondre à l invitation » seul', () => {
    const carte = monter(INVITATION, { onEventPress: jest.fn() });

    expect(carte.textes.slice(0, 3)).toEqual([
      'Invitation à un événement', 'Invitation', 'FC Voisin invite Senior à son tournoi.',
    ]);
    // La date dépend du fuseau : on n'affirme que sa présence.
    expect(carte.textes[3]).toMatch(/\d/);
    expect(carte.boutons.map((/** @type {any} */ b) => b.titre))
      .toEqual(["Répondre à l'invitation"]);
    act(() => carte.arbre.unmount());
  });

  test('installation : pastilles, places occupées, puis Refuser / Autoriser côte à côte', () => {
    const carte = monter(INSTALLATION, { onPrimaryPress: jest.fn(), onSecondaryPress: jest.fn() });

    expect(carte.textes).toEqual(expect.arrayContaining([
      'Dépassement de créneau', 'Installation', 'Gymnase Nord', 'U13', '2/2 places occupées',
    ]));
    expect(carte.boutons.map((/** @type {any} */ b) => b.titre)).toEqual(['Refuser', 'Autoriser']);
    attendreCoteACote(carte);
    act(() => carte.arbre.unmount());
  });

  test('à la une : deux pastilles, la phrase, puis Refuser / Accepter côte à côte', () => {
    const carte = monter(A_LA_UNE, { onPrimaryPress: jest.fn(), onSecondaryPress: jest.fn() });

    expect(carte.textes.slice(0, 4)).toEqual([
      'À la une : Tournoi de printemps',
      'À la une',
      'Club',
      'Tournoi de printemps demande la une du club.',
    ]);
    expect(carte.boutons.map((/** @type {any} */ b) => b.titre)).toEqual(['Refuser', 'Accepter']);
    attendreCoteACote(carte);
    act(() => carte.arbre.unmount());
  });

  test('match amical : la phrase et « Voir la proposition » seul', () => {
    const carte = monter(AMICAL, { onPrimaryPress: jest.fn() });

    expect(carte.textes.slice(0, 3)).toEqual([
      'Proposition de match amical', 'Demande', 'FC Voisin propose un match à Senior.',
    ]);
    expect(carte.boutons.map((/** @type {any} */ b) => b.titre)).toEqual(['Voir la proposition']);
    act(() => carte.arbre.unmount());
  });

  test('intérêt d un ADULTE : l adulte reste l adulte, ordre des boutons inchangé (L9a)', () => {
    const surProfil = jest.fn();
    const carte = monter(INTERET_ADULTE, {
      onPrimaryPress: jest.fn(), onRequesterPress: surProfil, onSecondaryPress: jest.fn(),
    });

    expect(carte.textes.slice(0, 3)).toEqual([
      'Intérêt club', 'Intérêt', 'Maryline Monroe est intéressé par U11 Filles.',
    ]);
    expect(carte.avatars).toHaveLength(1);
    expect(carte.avatars[0].props)
      .toMatchObject({ imageUrl: '/maryline.jpg', name: 'Maryline Monroe' });
    expect(carte.boutons.map((/** @type {any} */ b) => [b.titre, b.icone]))
      .toEqual([['Voir le profil', undefined], ['Ouvrir chat', undefined], ['Répondre', 'check']]);
    // Toucher la ligne du demandeur ouvre toujours l'adulte.
    act(() => ancetre(carte.avatars[0], TouchableOpacity).props.onPress());
    expect(surProfil).toHaveBeenCalledWith(INTERET_ADULTE);
    act(() => carte.arbre.unmount());
  });

  test('carte occupée : chaque bouton est désactivé', () => {
    const carte = monter({ ...INTERET_ADULTE }, {
      isBusy: true,
      onPrimaryPress: jest.fn(),
      onRequesterPress: jest.fn(),
      onSecondaryPress: jest.fn(),
    });
    const boutons = carte.arbre.root.findAllByType(Button);
    expect(boutons).toHaveLength(3);
    boutons.forEach((/** @type {any} */ bouton) => expect(bouton.props.disabled).toBe(true));
    act(() => carte.arbre.unmount());
  });
});
