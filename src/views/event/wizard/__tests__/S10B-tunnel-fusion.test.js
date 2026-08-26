import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import { RouteNames } from '@/navigation/routeNames';

import { EventWizardProvider, useEventWizard } from '../EventWizardContext';
import EventWizardParticipants from '../EventWizardParticipants';

// ═══════════════════════════════════════════════════════════════════════════
// S10-B — LE TUNNEL FUSIONNE : « qui vient ? » se repond en UNE SEULE ETAPE.
//
// 🧭 Cadre d'Adel du 2026-08-25 : une seule etape pour choisir qui vient — mes
// equipes et les autres equipes de MON club, tout le groupe OU des membres
// coches. AUCUN externe ici : les equipes d'un autre club se convient
// uniquement sur un MATCH, depuis l'etape « Contre qui ? ».
//
// 🔒 CE QUE CE FICHIER GARDE, ET POURQUOI C'EST LE POINT DELICAT DU LOT :
// l'etape « Participants » ecrit desormais DEUX choses qui se ressemblent et
// qui ne doivent JAMAIS se melanger —
//   · `teamAudiences` / `invitedTeams` = QUI EST CONVIE (une equipe entiere ou
//     certains de ses membres) ;
//   · `matchCallUpPlayerIds`          = QUI EST CONVOQUE (le brouillon de
//     composition d'un match, rejoue apres la creation).
// Les fusionner rendrait faux le temoin 6 d'AA10, et ferait apparaitre
// l'equipe organisatrice dans `invitedTeams` — c'est-a-dire « U15 A vs U15 A »
// sur la carte de l'evenement.
// ═══════════════════════════════════════════════════════════════════════════

const TYPE_MATCH = { documentId: 'type-match', name: 'Match' };

/** L'equipe organisatrice, telle que l'etape 2 la depose dans le tunnel. */
const EQUIPE_ORGANISATRICE = {
  club: { documentId: 'club-1', name: 'FC Test' },
  documentId: 'equipe-1',
  name: 'U15 A',
  sport: { documentId: 'sport-1', name: 'Football' },
};

/** Les equipes que le serveur rend pour le club de l'organisateur. */
const EQUIPES_DU_CLUB = [
  // ⚠️ L'organisatrice EST dans la reponse du serveur : c'est l'ecran qui doit
  // la retirer. La mettre ici est ce qui rend le temoin ② capable d'echouer.
  EQUIPE_ORGANISATRICE,
  {
    club: { documentId: 'club-1', name: 'FC Test' },
    documentId: 'equipe-2',
    members: [],
    name: 'U17 B',
    players: [
      { documentId: 'j10', firstname: 'Sofiane', lastname: 'Amrani' },
      { documentId: 'j11', firstname: 'Noe', lastname: 'Girard' },
    ],
    trainers: [{ documentId: 'c1', firstname: 'Paul', lastname: 'Renard' }],
  },
];

/** Une invitation d'equipe EXTERNE deja posee par l'etape « Contre qui ? ». */
const AUDIENCE_EXTERNE = {
  audienceKind: 'external_invited',
  selectedMembers: [],
  selectionMode: 'ALL_MEMBERS',
  status: 'PENDING',
  team: {
    club: { documentId: 'club-9', name: 'US Voisine' },
    documentId: 'equipe-9',
    name: 'U15 A',
  },
};

/** Ce que la doublure de `getTeams` rend — pilotable par chaque temoin. */
const mockReponseEquipes = { data: EQUIPES_DU_CLUB };

jest.mock('react-i18next', () => ({
  initReactI18next: { init: () => {}, type: '3rdParty' },
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli, /** @type {any} */ options) => {
      let modele = cle;
      if (typeof repli === 'string') modele = repli;
      else if (repli && typeof repli.defaultValue === 'string') modele = repli.defaultValue;

      const valeurs = (repli && typeof repli === 'object') ? repli : options;
      if (!valeurs) return modele;

      return String(modele).replace(
        /\{\{(\w+)\}\}/g,
        (/** @type {string} */ trouve, /** @type {string} */ nom) => (
          valeurs[nom] === undefined ? trouve : String(valeurs[nom])
        ),
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

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({
    userData: {
      club: { documentId: 'club-1' },
      documentId: 'moi',
      // L'organisateur entraine U17 B : elle doit atterrir sous « Mes equipes ».
      trainedTeams: [{ documentId: 'equipe-2' }],
    },
  }),
}));

// ⛔ Jamais `requireActual` sur un service : le client HTTP exige `API_URL` et
// la suite entiere meurt au CHARGEMENT (0 test execute).
jest.mock('@/services/team/teamService', () => ({
  getTeams: () => Promise.resolve(mockReponseEquipes),
}));

jest.mock('@/services/team/teamQueries', () => ({
  useGetTeam: () => ({ data: undefined, isLoading: false }),
}));

/** Proprietes recues par le gabarit d'etape, dans l'ordre du rendu. */
const mockProprietesDuGabarit = [];

jest.mock('@/components/molecules/wizardStepLayout/WizardStepLayout', () => function GabaritMock(
  /** @type {any} */ props,
) {
  mockProprietesDuGabarit.push(props);
  return props.children;
});

// La feuille du bas rend son contenu des qu'elle est visible : c'est ce qui
// permet de piloter « tout le groupe » / « certains membres » sans monter
// @gorhom.
jest.mock('@/components/molecules/bottomModal/BottomModal', () => function FeuilleMock(
  /** @type {any} */ props,
) {
  return props.isVisible ? props.children : null;
});

jest.mock('@/components/molecules/segmentedControl/SegmentedControl', () => () => null);
jest.mock('@/components/molecules/profileAvatar/ProfileAvatar', () => () => null);
jest.mock('@/components/atoms/checkbox/Checkbox', () => () => null);
jest.mock('@/components/organisms/positionSelectionList/PositionSelectionList', () => () => null);

jest.mock('@/components/atoms/button/Button', () => function BoutonMock(/** @type {any} */ props) {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return reactActuel.createElement(
    PressableRN,
    { accessibilityRole: 'button', disabled: Boolean(props.disabled), onPress: props.onPress },
    reactActuel.createElement(TexteRN, null, props.title),
  );
});

// La carte d'equipe rendue comme un pressable portant le NOM de l'equipe et son
// resume de selection : on vise le texte, jamais une forme d'arbre.
jest.mock('@/views/event/wizard/components/EventWizardTeamCard', () => function CarteEquipeMock(
  /** @type {any} */ props,
) {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return reactActuel.createElement(
    PressableRN,
    { accessibilityRole: 'button', onPress: props.onPress },
    reactActuel.createElement(TexteRN, null, props.team?.name),
    reactActuel.createElement(TexteRN, null, props.selectionSummary),
  );
});

/**
 * Le dispatch du tunnel, capte pour semer l'etat de depart.
 * @type {(action: any) => void}
 */
let semer = () => {};
/** L'etat courant du tunnel, relu par les temoins apres chaque geste. */
let etatCourant = /** @type {any} */ ({});

/**
 * Sonde sans rendu : elle expose le `dispatch` et l'etat du tunnel.
 * @returns {null} Rien.
 */
function PriseDeCourant() {
  const { dispatch, state } = useEventWizard();
  semer = dispatch;
  etatCourant = state;
  return null;
}

/**
 * Tous les textes rendus sous un noeud de l'arbre de test.
 * @param {any} noeud Le noeud a parcourir.
 * @returns {string[]} Les textes trouves.
 */
const textesSous = (noeud) => {
  /** @type {string[]} */
  const sortie = [];
  const parcourir = (/** @type {any} */ enfant) => {
    if (typeof enfant === 'string' || typeof enfant === 'number') {
      sortie.push(String(enfant));
      return;
    }
    if (Array.isArray(enfant)) {
      enfant.forEach(parcourir);
      return;
    }
    if (enfant?.children) enfant.children.forEach(parcourir);
  };
  parcourir(noeud.children);
  return sortie;
};

/**
 * Monte l'etape « Participants » sur un etat de tunnel seme, et laisse le
 * reseau repondre.
 *
 * ⚠️ Deux temps, et l'ordre compte : chaque ecran lit l'etat du tunnel dans le
 * `useState` de son PREMIER rendu. Semer apres coup ne changerait rien.
 * @param {any} etatSeme L'etat du tunnel au moment de l'ouverture.
 * @param {any} [parametresDEcran] Les `route.params` (dont le billet `returnTo`).
 * @returns {Promise<any>} L'ecran monte et ses aides.
 */
const monterParticipants = async (etatSeme, parametresDEcran = {}) => {
  /** @type {string[]} */
  const destinations = [];
  const navigation = {
    goBack: () => {},
    navigate: (/** @type {string} */ nom) => destinations.push(nom),
    push: (/** @type {string} */ nom) => destinations.push(nom),
    replace: (/** @type {string} */ nom) => destinations.push(nom),
    setParams: () => {},
  };

  const rendre = (/** @type {any} */ contenu) => createElement(
    EventWizardProvider,
    null,
    createElement(PriseDeCourant),
    contenu,
  );

  /** @type {any} */
  let arbre;
  await act(async () => { arbre = renderer.create(rendre(null)); });
  await act(async () => { semer({ payload: etatSeme, type: 'SET_META' }); });
  await act(async () => {
    arbre.update(rendre(createElement(EventWizardParticipants, {
      navigation,
      route: { params: parametresDEcran },
    })));
  });
  // La section appelle `getTeams` dans un effet : on laisse la promesse rendre.
  await act(async () => { await Promise.resolve(); });

  const presserLeTexte = async (/** @type {string} */ libelle) => {
    const pressables = arbre.root.findAll(
      (/** @type {any} */ noeud) => typeof noeud.props?.onPress === 'function',
      { deep: true },
    );
    const cible = pressables.find(
      (/** @type {any} */ noeud) => textesSous(noeud).includes(libelle),
    );
    if (!cible) {
      const vus = pressables
        .map((/** @type {any} */ noeud) => textesSous(noeud).join('|'))
        .filter(Boolean);
      throw new Error(
        `aucun pressable ne porte le texte « ${libelle} ». Pressables vus : ${JSON.stringify(vus)}`,
      );
    }
    await act(async () => { cible.props.onPress(); });
  };

  return {
    demonter: () => act(() => arbre.unmount()),
    destinations,
    gabarit: () => mockProprietesDuGabarit[mockProprietesDuGabarit.length - 1] || {},
    presserLeTexte,
    textes: () => textesSous(arbre.root),
  };
};

const ETAT_MATCH = { team: EQUIPE_ORGANISATRICE, type: TYPE_MATCH };

beforeEach(() => {
  mockReponseEquipes.data = EQUIPES_DU_CLUB;
  mockProprietesDuGabarit.length = 0;
});

describe('S10-B D1 — inviter une equipe de mon club, DANS l etape Participants', () => {
  test('temoin 1 — la section est a l ecran, avec les equipes du club', async () => {
    const { demonter, textes } = await monterParticipants(ETAT_MATCH);
    const rendus = textes();

    expect(rendus).toContain('Inviter des membres d une équipe de mon club');
    expect(rendus).toContain('U17 B');

    demonter();
  });

  test('temoin 2 🔒 — l equipe ORGANISATRICE ne se propose jamais elle-meme', async () => {
    // Le serveur la rend (elle est dans `EQUIPES_DU_CLUB`) : c'est l'ecran qui
    // doit la retirer. S'inviter soi-meme ferait « U15 A vs U15 A » sur la
    // carte de l'evenement (`EventCardNew.js:504`).
    const { demonter, textes } = await monterParticipants(ETAT_MATCH);

    expect(textes().filter((texte) => texte === 'U15 A')).toEqual([]);

    demonter();
  });

  test('temoin 3 — inviter TOUT LE GROUPE ecrit une audience acceptee', async () => {
    const { demonter, presserLeTexte } = await monterParticipants(ETAT_MATCH);

    await presserLeTexte('U17 B');
    await presserLeTexte('Inviter tous les membres');
    await presserLeTexte('Enregistrer');

    expect(etatCourant.teamAudiences).toEqual([{
      audienceKind: 'internal_invited',
      selectedMembers: [],
      selectionMode: 'ALL_MEMBERS',
      // Une equipe de MON club embarque sans avoir a accepter (cadre d'Adel,
      // reponse 3) : le statut part deja a ACCEPTED.
      status: 'ACCEPTED',
      team: EQUIPES_DU_CLUB[1],
    }]);
    // Le miroir `invitedTeams`, c'est-a-dire ce que la charge de creation porte.
    expect(etatCourant.invitedTeams).toEqual(['equipe-2']);

    demonter();
  });

  test('temoin 4 — cocher CERTAINS MEMBRES garde la liste des coches', async () => {
    const { demonter, presserLeTexte } = await monterParticipants(ETAT_MATCH);

    await presserLeTexte('U17 B');
    await presserLeTexte('Choisir certains membres');
    await presserLeTexte('Sofiane Amrani');
    await presserLeTexte('Paul Renard');
    await presserLeTexte('Enregistrer');

    expect(etatCourant.teamAudiences).toEqual([{
      audienceKind: 'internal_invited',
      selectedMembers: ['j10', 'c1'],
      selectionMode: 'SELECTED_MEMBERS',
      status: 'ACCEPTED',
      team: EQUIPES_DU_CLUB[1],
    }]);

    demonter();
  });

  test('temoin 5 — le resume de la carte dit ce qui est convie', async () => {
    const { demonter, presserLeTexte, textes } = await monterParticipants(ETAT_MATCH);

    expect(textes()).toContain('Appuie pour choisir les membres ou inviter toute l equipe.');

    await presserLeTexte('U17 B');
    await presserLeTexte('Choisir certains membres');
    await presserLeTexte('Noe Girard');
    await presserLeTexte('Enregistrer');

    expect(textes()).toContain('1 membre(s) invites');

    demonter();
  });

  test('temoin 6 — retirer une invitation la retire des DEUX sorties', async () => {
    const { demonter, presserLeTexte } = await monterParticipants(ETAT_MATCH);

    await presserLeTexte('U17 B');
    await presserLeTexte('Inviter tous les membres');
    await presserLeTexte('Enregistrer');
    await presserLeTexte('U17 B');
    await presserLeTexte('Retirer cette invitation');

    expect(etatCourant.teamAudiences).toEqual([]);
    expect(etatCourant.invitedTeams).toEqual([]);

    demonter();
  });

  test('temoin 7 🔒 — une invitation EXTERNE deja posee survit a une ecriture interne', async () => {
    // Les deux familles vivent dans la MEME liste `teamAudiences`, ecrite
    // depuis DEUX ecrans differents. Sans le point de passage unique
    // (`useEventWizardAudiences`), l'etape Participants ecraserait l'equipe
    // adverse choisie a l'etape « Contre qui ? ».
    const { demonter, presserLeTexte } = await monterParticipants({
      ...ETAT_MATCH,
      teamAudiences: [AUDIENCE_EXTERNE],
    });

    await presserLeTexte('U17 B');
    await presserLeTexte('Inviter tous les membres');
    await presserLeTexte('Enregistrer');

    expect(etatCourant.teamAudiences).toContainEqual(AUDIENCE_EXTERNE);
    expect(etatCourant.teamAudiences).toHaveLength(2);
    // ⛔ Et l'externe n'entre PAS dans `invitedTeams` : elle est « en attente »
    // tant que son coach n'a pas repondu.
    expect(etatCourant.invitedTeams).toEqual(['equipe-2']);

    demonter();
  });

  test('temoin 8 🔒 — CONVIER et CONVOQUER restent deux canaux separes', async () => {
    // Le jumeau du temoin 6 d'AA10, pris dans l'autre sens : la ou AA10 prouve
    // qu'une convocation ne touche pas aux invitations, celui-ci prouve qu'une
    // invitation ne touche pas a la convocation.
    const { demonter, presserLeTexte } = await monterParticipants(ETAT_MATCH);

    await act(async () => { semer({ payload: ['j1', 'j3'], type: 'SET_MATCH_CALL_UP' }); });
    await presserLeTexte('U17 B');
    await presserLeTexte('Inviter tous les membres');
    await presserLeTexte('Enregistrer');

    expect(etatCourant.matchCallUpPlayerIds).toEqual(['j1', 'j3']);
    expect(etatCourant.invitedTeams).toEqual(['equipe-2']);

    demonter();
  });

  test('temoin 9 — un club sans autre equipe le DIT, il ne laisse pas un vide', async () => {
    mockReponseEquipes.data = [EQUIPE_ORGANISATRICE];

    const { demonter, textes } = await monterParticipants(ETAT_MATCH);

    expect(textes()).toContain('eventWizard.errors.noOtherTeams');

    demonter();
  });
});

describe('S10-B D3 — un entrainement PRIVE peut encore inviter une equipe', () => {
  // 🧨 LE PIEGE MORTEL DU LOT, ET IL ETAIT INVISIBLE.
  //
  // `shouldSkipEventWizardParticipantsStep` saute l'etape Participants pour un
  // entrainement FERME : il n'a ni capacite ni quota a demander. Mais depuis
  // S10-B, cette etape est AUSSI la seule porte vers « inviter une equipe de mon
  // club ». Et le redirect de saut IGNORAIT le billet `returnTo` : la rangee du
  // Recap aurait ouvert l'etape, qui serait repartie vers « Acces » avant meme
  // d'avoir rendu quoi que ce soit.
  //
  // → Un entrainement prive n'aurait plus JAMAIS pu inviter une equipe interne,
  //   et aucune porte du depot ne l'aurait vu : la chaine reste juste, le Recap
  //   reste nomme, l'ecran redirige en silence.
  const ETAT_ENTRAINEMENT_PRIVE = {
    sessionStatus: 'closed',
    team: EQUIPE_ORGANISATRICE,
    type: { documentId: 'type-entrainement', name: 'Entrainement' },
  };
  const BILLET_DU_RECAP = { returnTo: RouteNames.EventWizardRecap };

  test('temoin 10 🔒 — ouverte depuis le Recap, l etape SE REND au lieu de fuir', async () => {
    const { demonter, destinations, textes } = await monterParticipants(
      ETAT_ENTRAINEMENT_PRIVE,
      BILLET_DU_RECAP,
    );

    expect(destinations).toEqual([]);
    expect(textes()).toContain('Inviter des membres d une équipe de mon club');
    expect(textes()).toContain('U17 B');

    demonter();
  });

  test('temoin 11 — et elle invite pour de vrai, pas seulement a l ecran', async () => {
    const { demonter, presserLeTexte } = await monterParticipants(
      ETAT_ENTRAINEMENT_PRIVE,
      BILLET_DU_RECAP,
    );

    await presserLeTexte('U17 B');
    await presserLeTexte('Inviter tous les membres');
    await presserLeTexte('Enregistrer');

    expect(etatCourant.invitedTeams).toEqual(['equipe-2']);

    demonter();
  });

  test('temoin 12 🔒 — SANS le billet, elle saute toujours vers Acces', async () => {
    // Le garde-fou du correctif : le saut normal du tunnel ne doit pas bouger.
    // Un entrainement prive traverse en 7 ecrans, sans passer par Participants.
    const { demonter, destinations } = await monterParticipants(ETAT_ENTRAINEMENT_PRIVE);

    expect(destinations).toEqual([RouteNames.EventWizardAccess]);

    demonter();
  });

  test('temoin 13 — l etape hors chaine n annonce AUCUN numero', async () => {
    // Son rang vaut 0 : afficher « Étape 0/7 » serait un mensonge. Le meme piege
    // qu'AA10 avait nomme sur l'ecran des invitations.
    const { demonter, gabarit } = await monterParticipants(
      ETAT_ENTRAINEMENT_PRIVE,
      BILLET_DU_RECAP,
    );

    expect(gabarit().stepIndex).toBeUndefined();
    expect(gabarit().stepCount).toBeUndefined();

    demonter();
  });

  test('temoin 14 — un entrainement OUVERT garde son etape entiere', async () => {
    // Le jumeau : l'etape n'est PAS sautee, donc elle annonce son rang et garde
    // tout ce qu'elle demandait avant le lot.
    const { demonter, gabarit, textes } = await monterParticipants({
      ...ETAT_ENTRAINEMENT_PRIVE,
      sessionStatus: 'open',
    });

    expect(gabarit().stepIndex).toBe(5);
    expect(gabarit().stepCount).toBe(8);
    expect(textes()).toContain('Inviter des membres d une équipe de mon club');

    demonter();
  });
});
