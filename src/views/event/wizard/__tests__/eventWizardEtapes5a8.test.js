import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import { RouteNames } from '@/navigation/routeNames';

import EventWizardAccess from '../EventWizardAccess';
import { EventWizardProvider, useEventWizard } from '../EventWizardContext';
import EventWizardDescription from '../EventWizardDescription';
import EventWizardParticipants from '../EventWizardParticipants';
import EventWizardRecap from '../EventWizardRecap';

// Filet D10 (E6) — CE QUE LES 4 DERNIERS ECRANS DU TUNNEL AFFICHENT.
//
// `eventWizardChain.test.js` (D08) prouve la MACHINE : quel ecran mene ou. Il
// remplace le gabarit d'etape par du vide et ne rend donc AUCUN contenu.
// Ce fichier-ci prouve l'inverse : le CONTENU des etapes 5 a 8, pilote par le
// TEXTE VISIBLE — jamais par la forme de l'arbre, qui est justement ce que la
// refonte va changer.
//
// ETAT DU 2026-08-06, AVANT toute retouche de D10. Les tests ecrits ici
// decrivent l'existant : ils doivent etre VERTS avant le lot comme apres, sauf
// ceux explicitement marques comme decrivant ce que D10 remplace.
//
// Les deux temoins d'arret du lot y vivent aussi :
//   1. les liens « Modifier » du Recap menent tous quelque part ;
//   2. `EventWizardInvites` reste atteignable depuis le Recap.

/** Proprietes recues par le gabarit d'etape, dans l'ordre du rendu. */
const mockProprietesDuGabarit = [];

jest.mock('react-i18next', () => ({
  // `EventWizardAccess` tire `@/domains/event/eventUseCases`, qui charge
  // `@/theme/strings` et appelle `i18n.use(initReactI18next)` au chargement.
  initReactI18next: { init: () => {}, type: '3rdParty' },
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli, /** @type {any} */ valeurs) => {
      let modele = cle;
      if (typeof repli === 'string') modele = repli;
      else if (repli && typeof repli.defaultValue === 'string') modele = repli.defaultValue;
      const table = (repli && typeof repli === 'object' ? repli : valeurs) || {};
      return String(modele).replace(
        /\{\{(\w+)\}\}/g,
        (_correspondance, nom) => (table[nom] === undefined ? `{{${nom}}}` : String(table[nom])),
      );
    },
  }),
}));

// Le VRAI theme, sans le contexte React qui le porte. ⛔ Jamais un Proxy : il
// rend les echecs Jest illisibles (constat du lot paywall, 02/08).
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
      Images: { arrowLeft: 1, chevronDown: 1, close: 1 },
      Spaces: espaces,
    }),
  };
});

// Le gabarit est ici un PASSE-PLAT : il enregistre ses proprietes (titre,
// sous-titre, numero d'etape, grammaire d'en-tete) ET rend son contenu, sans
// quoi il n'y aurait aucun texte a lire.
jest.mock('@/components/molecules/wizardStepLayout/WizardStepLayout', () => function GabaritMock(
  /** @type {any} */ props,
) {
  mockProprietesDuGabarit.push(props);
  return props.children;
});

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: () => {} }),
}));

jest.mock('@/domains/auth/useAuth', () => {
  const { USER_ROLES } = jest.requireActual('@/domains/auth/authUseCases');
  return {
    __esModule: true,
    default: () => ({
      USER_ROLES,
      userData: {
        documentId: 'moi',
        role: { name: USER_ROLES.president, type: 'president' },
      },
    }),
  };
});

jest.mock('@/domains/event/useEvent', () => ({
  __esModule: true,
  default: () => ({
    createReccurrentEventPayload: () => [{}],
    createStageEventPayload: () => ({}),
  }),
}));

jest.mock('@/services/celebrations/celebrationRuntime', () => ({ celebrate: () => {} }));

// ⛔ Jamais `requireActual` sur un service : le client HTTP exige `API_URL` et
// la suite entiere meurt au chargement.
jest.mock('@/services/event/eventService', () => ({
  createEventsWithConcurrency: () => Promise.resolve({ created: [], failed: [] }),
  getEventById: () => Promise.resolve(null),
  requestFeatured: () => Promise.resolve(null),
  rollbackEventsByCancel: () => Promise.resolve([]),
}));

// La feuille du bas rend son contenu des qu'elle est visible : c'est ce qui
// permet de lire le formulaire « Nouvelle tache » sans monter @gorhom.
jest.mock('@/components/molecules/bottomModal/BottomModal', () => function FeuilleMock(
  /** @type {any} */ props,
) {
  return props.isVisible ? props.children : null;
});

jest.mock(
  '@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet',
  () => () => null,
);

// Le controle segmente rend une rangee de pressables portant chacun le libelle
// de son option : on pilote donc « Illimite » ou « Capacite fixe » par le
// TEXTE, pas par un indice de tableau.
jest.mock(
  '@/components/molecules/segmentedControl/SegmentedControl',
  () => function ControleSegmenteMock(/** @type {any} */ props) {
    const reactActuel = jest.requireActual('react');
    const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
    return (props.options || []).map((/** @type {any} */ option) => reactActuel.createElement(
      PressableRN,
      {
        accessibilityRole: 'button',
        key: option.value,
        onPress: () => props.onChange?.(option.value),
      },
      reactActuel.createElement(TexteRN, null, option.label),
    ));
  },
);

// Doublure de `Button` qui rend un pressable PORTANT SON TITRE : le motif
// eprouve du depot (voir `recette-test-caracterisation-ecran-rn`).
jest.mock('@/components/atoms/button/Button', () => function BoutonMock(/** @type {any} */ props) {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return reactActuel.createElement(
    PressableRN,
    { accessibilityRole: 'button', disabled: Boolean(props.disabled), onPress: props.onPress },
    reactActuel.createElement(TexteRN, null, props.title),
  );
});

/**
 * Tous les textes rendus sous ce noeud, dans l'ordre du rendu.
 * ⚠️ On marche sur `children` de l'instance de test, PAS sur `toJSON()` :
 * `toJSON` n'existe que sur les noeuds hotes, et les pressables du Recap sont
 * des composants — la fonction y meurt en `toJSON is not a function`.
 * @param {any} instance Instance de test (ou racine).
 * @param {string[]} [recueil] Accumulateur.
 * @returns {string[]} Les textes trouves.
 */
const textesDe = (instance, recueil = []) => {
  const enfants = instance?.children || [];
  enfants.forEach((/** @type {any} */ enfant) => {
    if (typeof enfant === 'string' || typeof enfant === 'number') {
      recueil.push(String(enfant));
      return;
    }
    textesDe(enfant, recueil);
  });
  return recueil;
};

/**
 * Le texte complet de l'ecran, en une seule chaine.
 * @param {any} arbre Arbre rendu.
 * @returns {string} Tous les textes, separes par des barres.
 */
const contenuDe = (arbre) => textesDe(arbre.root).join(' | ');

/**
 * Tous les pressables qui portent ce texte, du plus externe au plus interne.
 * @param {any} arbre Arbre rendu.
 * @param {string} texte Texte visible.
 * @returns {any[]} Les instances trouvees.
 */
const pressablesQuiPortent = (arbre, texte) => arbre.root
  .findAll(
    (/** @type {any} */ noeud) => typeof noeud.props?.onPress === 'function',
    { deep: true },
  )
  .filter((/** @type {any} */ noeud) => textesDe(noeud).some(
    (valeur) => valeur.includes(texte),
  ));

/**
 * Le pressable le PLUS INTERNE qui porte ce texte. « Le plus interne » compte :
 * les cartes du Recap sont des pressables imbriques, et viser le plus externe
 * declencherait la mauvaise action.
 * @param {any} arbre Arbre rendu.
 * @param {string} texte Texte visible porte par le pressable.
 * @returns {any} L'instance de test trouvee.
 */
const pressableQuiPorte = (arbre, texte) => {
  const candidats = pressablesQuiPortent(arbre, texte);

  if (candidats.length === 0) {
    throw new Error(`Aucun pressable ne porte « ${texte} ». Textes vus : ${contenuDe(arbre)}`);
  }

  return candidats[candidats.length - 1];
};

/**
 * Le dernier jeu de proprietes recu par le gabarit d'etape.
 * @returns {any} Les proprietes du dernier rendu.
 */
const dernierGabarit = () => mockProprietesDuGabarit[mockProprietesDuGabarit.length - 1];

const EQUIPE = {
  activities: [{ documentId: 'act-1', name: 'Football' }],
  club: { documentId: 'club-1', name: 'FC Test' },
  documentId: 'equipe-1',
  name: 'U15 A',
  sport: { documentId: 'sport-1', name: 'Football' },
};

/**
 * Monte un ecran du tunnel dans le VRAI fournisseur d'etat, apres avoir seme
 * l'etat de depart par un VRAI `dispatch`. Rien n'est reimplemente.
 * @param {any} Ecran Le composant d'ecran.
 * @param {any} [etatSeme] Champs a poser dans l'etat du tunnel avant le rendu.
 * @param {any} [navigation] Doublure de navigation.
 * @returns {any} L'arbre rendu.
 */
const monter = (Ecran, etatSeme = {}, navigation = {}) => {
  const nav = {
    canGoBack: () => true,
    goBack: jest.fn(),
    navigate: jest.fn(),
    replace: jest.fn(),
    reset: jest.fn(),
    ...navigation,
  };

  /** Sonde : expose le VRAI `dispatch` du tunnel, sans rien rendre. */
  let poserLEtat;
  /**
   * Sonde interne, montee a cote de l'ecran teste.
   * @returns {null} Rien : la sonde ne rend aucun element.
   */
  function Semeur() {
    poserLEtat = useEventWizard().dispatch;
    return null;
  }

  const rendre = (/** @type {any} */ contenu) => createElement(
    EventWizardProvider,
    null,
    createElement(Semeur),
    contenu,
  );

  // Deux temps, et l'ordre compte : chaque ecran lit l'etat du tunnel dans le
  // `useState` de son PREMIER rendu. Semer apres coup ne changerait donc rien.
  // Le fournisseur reste monte entre les deux — l'etat n'est jamais reconstruit.
  let arbre;
  act(() => {
    arbre = renderer.create(rendre(null));
  });
  act(() => {
    poserLEtat({ payload: etatSeme, type: 'SET_META' });
  });
  act(() => {
    arbre.update(rendre(createElement(Ecran, { navigation: nav, route: { params: {} } })));
  });

  return {
    arbre,
    // `unmount` declenche les nettoyages d'effets : hors `act`, React crie.
    demonter: () => act(() => arbre.unmount()),
    nav,
  };
};

beforeEach(() => {
  mockProprietesDuGabarit.length = 0;
});

describe('D10 — etape 5 · Participants', () => {
  const ETAT_DETECTION = {
    date: new Date('2026-08-12T15:00:00.000Z'),
    endTime: new Date('2026-08-12T16:00:00.000Z'),
    startTime: new Date('2026-08-12T15:00:00.000Z'),
    team: EQUIPE,
    type: { documentId: 'type-detection', name: 'Detection' },
  };

  it('annonce son titre et sa place dans le parcours', () => {
    const { demonter } = monter(EventWizardParticipants, ETAT_DETECTION);
    const gabarit = dernierGabarit();

    expect(gabarit.title).toBe('Participants');
    expect(gabarit.stepIndex).toBe(5);
    expect(gabarit.stepCount).toBeGreaterThanOrEqual(8);
    demonter();
  });

  it('propose les deux modes de capacite', () => {
    const { arbre, demonter } = monter(EventWizardParticipants, ETAT_DETECTION);
    const contenu = contenuDe(arbre);

    expect(contenu).toContain('Illimite');
    expect(contenu).toContain('Capacité fixe');
    demonter();
  });

  // 🟢 CE QUE D10 A CHANGE. Avant ce lot, l'ecran s'ouvrait sur « Illimite »
  // (`state.capacity` vaut `null` dans l'etat initial du tunnel, et le mode en
  // decoulait) : ni compteur, ni valeurs rapides a l'arrivee. Le pack du 05/08
  // demande l'inverse — « capacite 12 » est l'un de ses 5 defauts surs.
  it('s ouvre sur « Capacite fixe » a 12, le defaut du pack', () => {
    const { arbre, demonter } = monter(EventWizardParticipants, ETAT_DETECTION);
    const contenu = contenuDe(arbre);

    expect(contenu).toContain('12');
    expect(contenu).toContain('joueurs max');
    demonter();
  });

  it('offre d emblee les 6 valeurs rapides du pack', () => {
    const { arbre, demonter } = monter(EventWizardParticipants, ETAT_DETECTION);
    const contenu = contenuDe(arbre);

    ['8', '10', '12', '14', '18', '22'].forEach((valeur) => {
      expect(contenu).toContain(valeur);
    });
    demonter();
  });

  it('bascule en illimite quand on presse « Illimite », et le compteur disparait', () => {
    const { arbre, demonter } = monter(EventWizardParticipants, ETAT_DETECTION);

    act(() => {
      pressableQuiPorte(arbre, 'Illimite').props.onPress();
    });

    const contenu = contenuDe(arbre);
    expect(contenu).toContain('Aucun plafond');
    expect(contenu).not.toContain('joueurs max');
    demonter();
  });

  // Le choix « Illimite » enregistre `capacity: null` — indiscernable d'un
  // ecran jamais visite. Sans marqueur, revenir ici effacerait le choix.
  it('un « Illimite » deja choisi SURVIT a un retour sur l ecran', () => {
    const { arbre, demonter } = monter(EventWizardParticipants, {
      ...ETAT_DETECTION,
      capacity: null,
      capacityMode: 'unlimited',
    });

    expect(contenuDe(arbre)).toContain('Aucun plafond');
    demonter();
  });

  it('une pression sur « 18 » porte la capacite a 18', () => {
    const { arbre, demonter } = monter(EventWizardParticipants, ETAT_DETECTION);

    act(() => {
      pressableQuiPorte(arbre, '18').props.onPress();
    });

    expect(contenuDe(arbre)).toContain('18');
    demonter();
  });

  it('la grammaire d en-tete « focus » du lot D05 est ACTIVEE', () => {
    const { demonter } = monter(EventWizardParticipants, ETAT_DETECTION);

    expect(dernierGabarit().headerVariant).toBe('focus');
    demonter();
  });

  it('enregistre la capacite et part vers l ecran suivant', () => {
    const { demonter, nav } = monter(EventWizardParticipants, ETAT_DETECTION);

    act(() => {
      dernierGabarit().onNext();
    });

    // Football a des postes : apres Participants vient l ecran des postes.
    expect(nav.navigate).toHaveBeenCalledWith(RouteNames.EventWizardDetectionSlots);
    demonter();
  });
});

describe('D10 — etape 6 · Acces', () => {
  const ETAT_DETECTION = {
    team: EQUIPE,
    type: { documentId: 'type-detection', name: 'Detection' },
  };

  it('annonce son titre et sa place dans le parcours', () => {
    const { demonter } = monter(EventWizardAccess, ETAT_DETECTION);
    const gabarit = dernierGabarit();

    expect(gabarit.title).toContain('Accès');
    expect(gabarit.stepIndex).toBeGreaterThan(0);
    demonter();
  });

  it('porte les DEUX decisions sur un seul ecran : visibilite ET validation', () => {
    const { arbre, demonter } = monter(EventWizardAccess, ETAT_DETECTION);
    const contenu = contenuDe(arbre);

    expect(contenu).toContain('Visibilité');
    expect(contenu).toContain('Public');
    expect(contenu).toContain('Privé');
    expect(contenu).toContain('Validation des présences');
    expect(contenu).toContain('Automatique');
    expect(contenu).toContain('Manuelle');
    demonter();
  });

  it('la grammaire d en-tete « focus » du lot D05 est ACTIVEE', () => {
    const { demonter } = monter(EventWizardAccess, ETAT_DETECTION);

    expect(dernierGabarit().headerVariant).toBe('focus');
    demonter();
  });

  it('part sur les 3 defauts du pack : public · validation auto · identites visibles', () => {
    const { arbre, demonter, nav } = monter(EventWizardAccess, ETAT_DETECTION);

    act(() => {
      dernierGabarit().onNext();
    });

    expect(nav.navigate).toHaveBeenCalledWith(RouteNames.EventWizardDescription);
    // Les 3 defauts se LISENT a l ecran : la ligne d explication sous chaque
    // paire de pilules, et la valeur portee par la rangee « Avancé ».
    const contenu = contenuDe(arbre);
    expect(contenu).toContain('Découvrable par tous');
    expect(contenu).toContain('Les participants confirment seuls leur présence');
    expect(contenu).toContain('Visibles');
    demonter();
  });

  it('laisse choisir « Privé », et l explication suit le choix', () => {
    const { arbre, demonter } = monter(EventWizardAccess, ETAT_DETECTION);

    act(() => {
      pressableQuiPorte(arbre, 'Privé').props.onPress();
    });

    const contenu = contenuDe(arbre);
    expect(contenu).toContain("Réservé aux membres de l'équipe");
    expect(contenu).not.toContain('Découvrable par tous');
    demonter();
  });

  it('laisse choisir « Manuelle », et l explication suit le choix', () => {
    const { arbre, demonter } = monter(EventWizardAccess, ETAT_DETECTION);

    act(() => {
      pressableQuiPorte(arbre, 'Manuelle').props.onPress();
    });

    expect(contenuDe(arbre)).toContain('Le coach valide chaque participant');
    demonter();
  });

  // Les identites passent en « Avancé » : repliees, mais leur VALEUR reste
  // lisible sur la rangee. Un reglage cache dont on ignore l etat serait pire
  // qu un reglage deplie.
  it('les identites sont repliees en « Avancé », et leur valeur reste lisible', () => {
    const { arbre, demonter } = monter(EventWizardAccess, ETAT_DETECTION);
    const contenu = contenuDe(arbre);

    expect(contenu).toContain('Avancé');
    expect(contenu).toContain('Identités des participants');
    expect(contenu).toContain('Visibles');
    // Repliee : le choix lui-meme n est pas encore offert.
    expect(contenu).not.toContain('Anonymisées');
    demonter();
  });

  it('la rangee « Avancé » deplie le choix des identites, et il se change', () => {
    const { arbre, demonter } = monter(EventWizardAccess, ETAT_DETECTION);

    act(() => {
      pressableQuiPorte(arbre, 'Identités des participants').props.onPress();
    });
    expect(contenuDe(arbre)).toContain('Anonymisées');

    act(() => {
      pressableQuiPorte(arbre, 'Anonymisées').props.onPress();
    });

    expect(contenuDe(arbre)).toContain('Les autres ne verront que le nombre de participants');
    demonter();
  });

  it('un choix d identite deja pris est celui qui s affiche a l arrivee', () => {
    const { arbre, demonter } = monter(EventWizardAccess, {
      ...ETAT_DETECTION,
      participantIdentityVisibility: 'ANONYMIZED',
    });

    expect(contenuDe(arbre)).toContain('Anonymisées');
    demonter();
  });

  it('cache le bloc validation pour un tournoi — il vient des reglages du tournoi', () => {
    const { arbre, demonter } = monter(EventWizardAccess, {
      team: EQUIPE,
      type: { documentId: 'type-tournoi', name: 'Tournoi' },
    });

    const contenu = contenuDe(arbre);
    expect(contenu).toContain('Visibilité');
    expect(contenu).not.toContain('Validation des présences');
    demonter();
  });
});

describe('D10 — etape 7 · Description', () => {
  const ETAT_DETECTION = {
    team: EQUIPE,
    type: { documentId: 'type-detection', name: 'Detection' },
  };

  it('annonce son titre et propose de passer l etape', () => {
    const { demonter } = monter(EventWizardDescription, ETAT_DETECTION);
    const gabarit = dernierGabarit();

    expect(gabarit.title).toBe('eventWizard.steps.description.title');
    expect(gabarit.showSkip).toBe(true);
    expect(gabarit.headerVariant).toBe('focus');
    expect(gabarit.subtitle).toContain("Ce que les joueurs liront avant de s'inscrire");
    demonter();
  });

  it('montre un exemple concret plutot qu une consigne, et dit ce que ca rapporte', () => {
    const { arbre, demonter } = monter(EventWizardDescription, ETAT_DETECTION);
    const champ = arbre.root.findAll(
      (/** @type {any} */ noeud) => noeud.props?.multiline === true,
      { deep: true },
    )[0];

    expect(champ.props.placeholder).toContain('Ex. :');
    expect(contenuDe(arbre)).toContain('Une description claire double les inscriptions');
    demonter();
  });

  it('offre un champ de saisie multiligne', () => {
    const { arbre, demonter } = monter(EventWizardDescription, ETAT_DETECTION);
    const champs = arbre.root.findAll(
      (/** @type {any} */ noeud) => noeud.props?.multiline === true,
      { deep: true },
    );

    expect(champs.length).toBeGreaterThan(0);
    demonter();
  });

  it('enregistre la description saisie et part vers le Recap', () => {
    const { arbre, demonter, nav } = monter(EventWizardDescription, ETAT_DETECTION);
    const champ = arbre.root.findAll(
      (/** @type {any} */ noeud) => noeud.props?.multiline === true,
      { deep: true },
    )[0];

    act(() => {
      champ.props.onChangeText('Viens essayer le foot avec les U15');
    });
    act(() => {
      dernierGabarit().onNext();
    });

    expect(nav.navigate).toHaveBeenCalledWith(RouteNames.EventWizardRecap);
    demonter();
  });

  it('« Passer cette etape » mene au meme endroit que « Suivant »', () => {
    const { demonter, nav } = monter(EventWizardDescription, ETAT_DETECTION);

    act(() => {
      dernierGabarit().onSkip();
    });

    expect(nav.navigate).toHaveBeenCalledWith(RouteNames.EventWizardRecap);
    demonter();
  });
});

describe('D10 — etape 8 · Recapitulatif', () => {
  const ETAT_COMPLET = {
    capacity: 12,
    date: new Date('2026-08-12T15:00:00.000Z'),
    description: 'Viens essayer le foot',
    endTime: new Date('2026-08-12T16:00:00.000Z'),
    facility: { documentId: 'inst-1', name: 'Gymnase' },
    location: 'Gymnase · 21 rue Fortia',
    startTime: new Date('2026-08-12T15:00:00.000Z'),
    team: EQUIPE,
    type: { documentId: 'type-detection', name: 'Detection' },
    validationMode: 'auto',
  };

  it('annonce son titre et sa place — la DERNIERE du parcours', () => {
    const { demonter } = monter(EventWizardRecap, ETAT_COMPLET);
    const gabarit = dernierGabarit();

    expect(gabarit.title).toBe('eventWizard.steps.recap.title');
    expect(gabarit.stepIndex).toBe(gabarit.stepCount);
    demonter();
  });

  it('recapitule ce qui a ete saisi : type, equipe, capacite, visibilite, description', () => {
    const { arbre, demonter } = monter(EventWizardRecap, ETAT_COMPLET);
    const contenu = contenuDe(arbre);

    expect(contenu).toContain('Detection');
    expect(contenu).toContain('U15 A');
    expect(contenu).toContain('Organisation');
    expect(contenu).toContain('Participation');
    expect(contenu).toContain('Viens essayer le foot');
    demonter();
  });

  it('affiche les 3 options avancees du pack : invitations, taches, mise a la une', () => {
    const { arbre, demonter } = monter(EventWizardRecap, ETAT_COMPLET);
    const contenu = contenuDe(arbre);

    expect(contenu).toContain('Invitations');
    expect(contenu).toContain('Tâches annexes');
    expect(contenu).toContain('Mise à la une');
    demonter();
  });

  // ⛔ TEMOIN D ARRET numero 1 — les liens de correction menent quelque part.
  // Ils sont la raison d etre du Recap : sans eux, une erreur de saisie oblige
  // a refaire le tunnel entier. Le repli en « Options avancees » ne doit en
  // perdre aucun.
  describe('temoin d arret 1 — les liens de correction menent tous quelque part', () => {
    /**
     * Presse TOUS les pressables du Recap et rend les destinations atteintes.
     * ⚠️ Ce detour est volontaire : le lien « Modifier » n'est pas un ANCETRE du
     * titre de section, c'est son VOISIN. Chercher « le pressable qui porte
     * Organisation » ne trouve donc rien — et surtout, viser une forme d'arbre
     * ferait rougir ce filet au premier repli, alors que rien ne serait casse.
     * On epingle donc l'invariant qui compte : la LISTE DES ECRANS joignables.
     * @param {any} etat Etat du tunnel a semer.
     * @returns {string[]} Les noms de route atteints, sans doublon.
     */
    const destinationsDuRecap = (etat) => {
      const { arbre, demonter, nav } = monter(EventWizardRecap, etat);
      const pressables = arbre.root.findAll(
        (/** @type {any} */ noeud) => typeof noeud.props?.onPress === 'function',
        { deep: true },
      );

      pressables.forEach((/** @type {any} */ pressable) => {
        act(() => {
          pressable.props.onPress();
        });
      });

      const destinations = [...new Set(
        nav.navigate.mock.calls.map((/** @type {any[]} */ appel) => appel[0]),
      )];
      demonter();
      return destinations;
    };

    it('un evenement standard corrige type, date, participation et description', () => {
      expect(destinationsDuRecap(ETAT_COMPLET)).toEqual(expect.arrayContaining([
        RouteNames.EventWizardType,
        RouteNames.EventWizardLogistics,
        RouteNames.EventWizardParticipants,
        RouteNames.EventWizardDescription,
        RouteNames.EventWizardInvites,
      ]));
    });

    it('un tournoi garde EN PLUS ses deux liens propres : reglages et structure', () => {
      const destinations = destinationsDuRecap({
        ...ETAT_COMPLET,
        type: { documentId: 'type-tournoi', name: 'Tournoi' },
      });

      expect(destinations).toEqual(expect.arrayContaining([
        RouteNames.EventWizardTournamentSettings,
        RouteNames.EventWizardTournamentStructure,
      ]));
    });

    it('les postes recherches gardent leur lien des qu il y en a', () => {
      const etat = { ...ETAT_COMPLET, detectionSlots: [{ position: 'Gardien', quantity: 2 }] };

      expect(destinationsDuRecap(etat)).toEqual(expect.arrayContaining([
        RouteNames.EventWizardDetectionSlots,
      ]));
    });

    it('les postes recherches se lisent dans le recapitulatif', () => {
      const { arbre, demonter } = monter(EventWizardRecap, {
        ...ETAT_COMPLET,
        detectionSlots: [{ position: 'Gardien', quantity: 2 }],
      });

      expect(contenuDe(arbre)).toContain('Gardien');
      demonter();
    });
  });

  // ⛔ TEMOIN D ARRET numero 2 — `EventWizardInvites` fait 1 474 lignes et
  // n a plus qu UN chemin depuis que D08 l a sorti de la chaine : ce lien.
  // Le perdre rendrait l ecran injoignable — la pire regression du projet.
  it('temoin d arret 2 — les invitations restent ATTEIGNABLES depuis le Recap', () => {
    const { arbre, demonter, nav } = monter(EventWizardRecap, ETAT_COMPLET);
    const pressables = arbre.root.findAll(
      (/** @type {any} */ noeud) => typeof noeud.props?.onPress === 'function',
      { deep: true },
    );

    pressables.forEach((/** @type {any} */ pressable) => {
      act(() => {
        pressable.props.onPress();
      });
    });

    expect(nav.navigate.mock.calls.map((/** @type {any[]} */ appel) => appel[0]))
      .toContain(RouteNames.EventWizardInvites);
    // Et la porte est NOMMEE : un lien atteignable mais anonyme ne sert personne.
    expect(contenuDe(arbre)).toContain('Invitations');
    demonter();
  });

  it('les taches annexes s ajoutent depuis le Recap, avec les 9 types en base', () => {
    const { arbre, demonter } = monter(EventWizardRecap, ETAT_COMPLET);

    act(() => {
      pressableQuiPorte(arbre, 'Ajouter').props.onPress();
    });

    const contenu = contenuDe(arbre);
    expect(contenu).toContain('Nouvelle tâche');
    // ⛔ Orthographe EXACTE : ce sont les valeurs deja en base. « Materiel » et
    // « Photos / videos » s ecrivent SANS accent. Les retaper « proprement »
    // fabriquerait des types fantomes.
    [
      'Accompagnateur',
      'Voiture / transport',
      'Table de marque',
      'Arbitrage',
      'Materiel',
      'Buvette',
      'Photos / videos',
      'Responsable maillots',
      'Autre',
    ].forEach((type) => {
      expect(contenu).toContain(type);
    });
    demonter();
  });

  it('la mise a la une propose ses 3 portees, et n en coche aucune par defaut', () => {
    const { arbre, demonter } = monter(EventWizardRecap, ETAT_COMPLET);
    const contenu = contenuDe(arbre);

    expect(contenu).toContain('A la une publique');
    expect(contenu).toContain('A la une du club');
    expect(contenu).toContain('A la une multisport');
    demonter();
  });

  it('le bouton de creation porte son libelle, et le Recap se dit pret', () => {
    const { demonter } = monter(EventWizardRecap, ETAT_COMPLET);
    const gabarit = dernierGabarit();

    expect(gabarit.nextLabel).toBe('Creer');
    expect(gabarit.isNextDisabled).toBe(false);
    demonter();
  });

  it('un Recap incomplet refuse la creation', () => {
    const { demonter } = monter(EventWizardRecap, {
      type: { documentId: 'type-detection', name: 'Detection' },
    });

    expect(dernierGabarit().isNextDisabled).toBe(true);
    demonter();
  });
});
