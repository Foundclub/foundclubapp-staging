import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import CompositionMessageBubbleDuFil
  from '@/components/molecules/compositionMessageBubble/CompositionMessageBubbleDuFil';

import ConvocationLineupMessage from '../ConvocationLineupMessage';

// MESSAGERIE-1C — CE QUE 1C AJOUTE A LA CARTE D'UNE CONVOCATION DANS LE FIL : « Modifier » pour
// qui peut convoquer, le bloc « Reponses » (joueurs a la main comptes presents), et la notice
// « Composition modifiee ». La carte elle-meme est doublee : on observe les props qu'elle recoit
// (elles traversent la VRAIE `CompositionMessageBubbleDuFil`, montee en fonction-enfant comme
// dans le fil).

const TEAM = 'equipe-seniors';

/** @type {any} */
const mockState = {
  convocation: null,
  convocationOptions: null,
  messages: [],
  user: null,
};

jest.mock('react-i18next', () => {
  const traductions = jest.requireActual('@/theme/strings/translations/fr').default;
  const lire = (/** @type {string} */ cle) => String(cle || '').split('.').reduce(
    (/** @type {any} */ noeud, /** @type {string} */ segment) => (
      noeud && typeof noeud === 'object' ? noeud[segment] : undefined
    ),
    traductions,
  );
  return {
    useTranslation: () => ({
      t: (/** @type {string} */ cle, /** @type {any} */ options) => {
        let valeur = lire(cle);
        // Regle du francais (CLDR) : 0 et 1 sont au singulier.
        if (typeof valeur !== 'string' && options && options.count !== undefined) {
          valeur = lire(`${cle}_${Math.abs(options.count) < 2 ? 'one' : 'other'}`);
        }
        if (typeof valeur !== 'string') return cle;
        return valeur.replace(/{{(\w+)}}/g, (_tout, nom) => (
          options && options[nom] !== undefined ? String(options[nom]) : ''
        ));
      },
    }),
  };
});

jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const couleurs = genererCouleurs();
  return {
    __esModule: true,
    default: () => ({ Colors: couleurs, Fonts: genererPolices(couleurs) }),
  };
});

jest.mock('@/store/authRuntime', () => ({
  getAuthRuntimeSnapshot: () => ({ auth: { user: mockState.user } }),
}));

jest.mock('@/services/chat/chatQueriesCompat', () => ({
  useGetChatById: () => ({ data: { participants: [] } }),
  useGetChatMessages: () => ({ data: { pages: [{ data: mockState.messages }] } }),
}));

jest.mock('@/services/event/eventQueries', () => ({
  useGetEventConvocation: (
    /** @type {string} */ _eventId,
    /** @type {any} */ _teamId,
    /** @type {any} */ options,
  ) => {
    mockState.convocationOptions = options;
    return { data: options?.enabled ? mockState.convocation : undefined };
  },
}));

jest.mock('@/components/molecules/compositionMessageBubble/CompositionMessageBubble', () => {
  const { Text: TexteRN, TouchableOpacity: Touche, View: Vue } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { onEdit, renderReponses }) => (
      <Vue>
        <TexteRN>CARTE</TexteRN>
        {onEdit ? (
          <>
            <Touche onPress={() => onEdit()} testID="carte-modifier">
              <TexteRN>Modifier</TexteRN>
            </Touche>
            <Touche onPress={() => onEdit('placement')} testID="carte-terrain">
              <TexteRN>Terrain</TexteRN>
            </Touche>
          </>
        ) : null}
        {renderReponses ? renderReponses() : null}
      </Vue>
    ),
  };
});

const player = (documentId, firstname, lastname) => ({ documentId, firstname, lastname });
const hugo = player('hugo', 'Hugo', 'Martin');
const sami = player('sami', 'Sami', 'Diallo');
const theo = player('theo', 'Théo', 'Garcia');
const rayan = player('rayan', 'Rayan', 'Delmaure');
const kevin = {
  documentId: 'manual_1', firstname: 'Kévin', id: 'manual_1', isManual: true, lastname: 'Main',
};

const carte = (/** @type {number} */ publishedVersion, /** @type {any[]} */ starters) => ({
  eventId: 'match-samedi',
  manualPlayers: [],
  placements: starters.map((p) => ({ playerId: p.documentId })),
  publishedVersion,
  reservePlayers: [],
  snapshotPlayers: starters,
  teamId: TEAM,
  teams: [{ placements: starters.map((p) => ({ playerId: p.documentId })) }],
  type: 'lineup_share',
});

const entraineur = {
  documentId: 'coach-1', role: { name: 'Entraineur' }, trainedTeams: [{ documentId: TEAM }],
};
const joueur = { documentId: 'hugo', role: { name: 'Joueur' }, trainedTeams: [] };

beforeEach(() => {
  mockState.user = entraineur;
  mockState.messages = [];
  mockState.convocationOptions = null;
  mockState.convocation = {
    branches: [{
      published: {
        manualPlayers: [kevin],
        requireResponse: true,
        reservePlayerIds: ['theo', 'manual_1'],
        snapshotPlayers: [hugo, sami, theo],
        teams: [{ placements: [{ playerId: 'hugo' }, { playerId: 'sami' }] }],
        version: 3,
      },
      responses: { byPlayerId: { hugo: 'present', sami: 'absent', theo: 'pending' } },
      team: { documentId: TEAM },
    }],
  };
});

/**
 * Rend la carte du fil.
 * @param {any} composition
 * @returns {{ arbre: any, onEdit: jest.Mock }}
 */
const rendre = (composition) => {
  const onEdit = jest.fn();
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      <ConvocationLineupMessage chatId="fil" composition={composition} onEdit={onEdit}>
        {(/** @type {any} */ extras) => (
          <CompositionMessageBubbleDuFil
            chatId="fil"
            composition={composition}
            onEdit={extras.onEdit}
            renderReponses={extras.renderReponses}
          />
        )}
      </ConvocationLineupMessage>,
    );
  });
  return { arbre, onEdit };
};

const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ noeud) => [].concat(noeud.props.children).join(''));

const toucher = (/** @type {any} */ arbre, /** @type {string} */ id) => {
  const bouton = arbre.root.findAll((/** @type {any} */ n) => n.props.testID === id
    && n.type === TouchableOpacity)[0];
  act(() => { bouton.props.onPress(); });
};

describe('MESSAGERIE-1C · « Modifier » sur la carte', () => {
  test('entraineur : « Modifier » ouvre les Joueurs, le terrain ouvre le Placement', () => {
    const composition = carte(3, [hugo, sami]);
    const { arbre, onEdit } = rendre(composition);
    toucher(arbre, 'carte-modifier');
    expect(onEdit).toHaveBeenLastCalledWith({ composition, startStep: 2 });
    toucher(arbre, 'carte-terrain');
    expect(onEdit).toHaveBeenLastCalledWith({ composition, startStep: 3 });
  });

  test('un joueur : ni « Modifier », ni bloc « Reponses », et aucune lecture des reponses', () => {
    mockState.user = joueur;
    const { arbre } = rendre(carte(3, [hugo, sami]));
    expect(textes(arbre)).not.toContain('Modifier');
    expect(textes(arbre)).not.toContain('RÉPONSES');
    expect(mockState.convocationOptions.enabled).toBe(false);
  });

  test('une carte qui n est pas une convocation publiee reste comme avant', () => {
    const { arbre } = rendre({ ...carte(3, [hugo]), type: 'lineup' });
    expect(textes(arbre)).toEqual(['CARTE']);
  });
});

describe('MESSAGERIE-1C · bloc « Reponses »', () => {
  test('presents, absents, sans reponse, avec les noms ; le manuel compte PRESENT', () => {
    const { arbre } = rendre(carte(3, [hugo, sami]));
    const vus = textes(arbre);
    expect(vus).toEqual(expect.arrayContaining([
      'RÉPONSES',
      'Présents · 2', 'Hugo Martin, Kévin Main',
      'Absents · 1', 'Sami Diallo',
      'Sans réponse · 1', 'Théo Garcia',
    ]));
  });

  test('pas de bloc quand on n a pas demande de reponse, ni sur une version depassee', () => {
    mockState.convocation.branches[0].published.requireResponse = false;
    expect(textes(rendre(carte(3, [hugo, sami])).arbre)).not.toContain('RÉPONSES');

    mockState.convocation.branches[0].published.requireResponse = true;
    expect(textes(rendre(carte(2, [hugo, sami])).arbre)).not.toContain('RÉPONSES');
  });
});

describe('MESSAGERIE-1C · notice « Composition modifiee »', () => {
  test('« (v3) : Rayan Delmaure remplace Sami Diallo », sur la v3 seulement', () => {
    const v2 = carte(2, [hugo, sami]);
    const v3 = carte(3, [hugo, rayan]);
    mockState.messages = [{ composition: v2 }, { composition: v3 }];

    expect(textes(rendre(v3).arbre))
      .toContain('Composition modifiée (v3) : Rayan Delmaure remplace Sami Diallo');
    expect(textes(rendre(v2).arbre).join(' ')).not.toContain('Composition modifiée');
  });

  test('plusieurs changements : « 2 joueurs ajoutés, 1 joueur retiré »', () => {
    const v1 = carte(1, [hugo, sami]);
    const v2 = carte(2, [hugo, rayan, theo]);
    mockState.messages = [{ composition: v1 }, { composition: v2 }];
    expect(textes(rendre(v2).arbre))
      .toContain('Composition modifiée (v2) : 2 joueurs ajoutés, 1 joueur retiré');
  });
});
