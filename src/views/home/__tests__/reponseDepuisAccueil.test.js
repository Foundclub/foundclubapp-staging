import fs from 'fs';
import path from 'path';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Alert } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { getEventById, respondToEventRsvp } from '@/services/event/eventService';

import { useHomeEventAnswer } from '../useHomeEventAnswer';

// T02 — SUR L'ACCUEIL, « PRESENT » ET « ABSENT » REPONDENT. ILS N'EMMENENT PLUS.
//
// Constat d'Adel du 2026-08-17 : « quand on fait Présent / Absent sur l'accueil,
// ça nous renvoie sur la page. Alors que NON : ça doit envoyer la réponse DIRECT,
// et ça se met à jour avec les statuts réels des boutons sur les détails de
// l'événement. »
//
// 🎯 CE QUE LE LOT PRECEDENT (S06) AVAIT FAIT, ET POURQUOI CE N'EST PAS LA MEME
// CHOSE. S06 a corrige la DESTINATION des trois variantes du bandeau : elles
// menaient au planning ou par un chemin fragile, elles menent maintenant toutes a
// l'evenement par `handleOpenEvent`. T02 change l'INTENTION des deux boutons du
// joueur : pour eux, naviguer n'est plus le bon comportement du tout. Les deux
// autres variantes (dirigeant, entraineur) gardent le travail de S06 — c'est le
// temoin 5.
//
// 🔬 CE QUI EST MESURE ICI, ET AVEC QUOI.
//   · Le COMPORTEMENT (temoins 1 a 4) sur `useHomeEventAnswer`, monte pour de
//     vrai dans un `QueryClientProvider`, avec le service mocke. C'est le seul
//     endroit ou vit la decision ; HomeHub ne fait que la cabler.
//   · Le CABLAGE (temoins 1 bis et 5) sur la SOURCE de HomeHub, meme motif que
//     ses quatre voisins de ce dossier (`accueilParRole.test.js:10`) : le fichier
//     fait plus de 2 600 lignes et depend d'une vingtaine de contextes React.

jest.mock('@/services/event/eventService', () => ({
  getEventById: jest.fn(),
  respondToEventRsvp: jest.fn(),
}));

jest.mock('react-i18next', () => ({
  initReactI18next: { init: jest.fn(), type: '3rdParty' },
  useTranslation: () => ({ t: (/** @type {string} */ key) => key }),
}));

const MOI = { documentId: 'user-1', id: 1 };

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: { documentId: 'user-1', id: 1 } }),
}));

const RACINE_SRC = path.resolve(__dirname, '..', '..', '..');
const CHEMIN_BOUTONS = 'components/molecules/eventAnswerButtons/EventAnswerButtons.js';

const SOURCE_HUB = fs.readFileSync(path.resolve(__dirname, '..', 'HomeHub.js'), 'utf8');
const SOURCE_BOUTONS = fs.readFileSync(path.join(RACINE_SRC, CHEMIN_BOUTONS), 'utf8');
const SOURCE_HOOK = fs.readFileSync(path.resolve(__dirname, '..', 'useHomeEventAnswer.js'), 'utf8');

const EVENEMENT_ID = 'evt-1';

/** Un evenement auquel je n'ai pas encore repondu. */
const SANS_REPONSE = {
  documentId: EVENEMENT_ID,
  missings: [],
  participationRequests: [],
  participations: [],
};

/** Le meme evenement, avec MA reponse « present » validee par le serveur. */
const REPONDU_PRESENT = {
  ...SANS_REPONSE,
  participationRequests: [{
    documentId: 'part-1',
    isActive: true,
    participationStatus: 'accepted',
    user: MOI,
  }],
  participations: [MOI],
};

/** Le meme evenement, avec MA reponse « absent » enregistree. */
const REPONDU_ABSENT = {
  ...SANS_REPONSE,
  missings: [MOI],
  participationRequests: [{
    documentId: 'part-1',
    isActive: true,
    participationStatus: 'missing',
    user: MOI,
  }],
};

/**
 * La sonde : elle ne rend rien, elle note ce que le hook dit a chaque rendu.
 * @param {{ vues: any[] }} props - Le carnet de bord, RECU EN PROP.
 * @returns {null} Rien a rendre.
 */
function SondeReponse({ vues }) {
  const { answer, isAnswering, submit } = useHomeEventAnswer(EVENEMENT_ID);
  vues.push({ answer, isAnswering, submit });
  return null;
}

/**
 * Laisse react-query redescendre jusqu'au rendu.
 *
 * 🧨 Les microtaches seules ne suffisent pas : le notificateur de react-query
 * repasse par la file des MACROtaches (mesure du 2026-08-12, `compteursAccueil`).
 * @param {number} [tours] - Nombre de tours de boucle d'evenements.
 * @returns {Promise<void>} Quand la file est videe.
 */
const vidangerLaFile = async (tours = 6) => {
  for (let tour = 0; tour < tours; tour += 1) {
    // eslint-disable-next-line no-await-in-loop -- l'attente est justement le sujet
    await act(async () => {
      await new Promise((resoudre) => { setTimeout(resoudre, 0); });
    });
  }
};

/**
 * Monte la sonde et rend de quoi la piloter puis la demonter.
 *
 * 🧹 Le demontage n'est pas une politesse : un arbre orphelin fait sortir jest
 * en 1 avec tous les tests verts (defaut paye par le lot D68).
 * @returns {Promise<{ demonter: () => Promise<void>, vues: any[] }>} La sonde.
 */
const monterLaSonde = async () => {
  /** @type {any[]} */
  const vues = [];
  // `retry: false` : ce test mesure l'etat rendu, pas le calendrier des reprises.
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  /** @type {any} */
  let arbre;

  await act(async () => {
    arbre = renderer.create(
      <QueryClientProvider client={queryClient}>
        <SondeReponse vues={vues} />
      </QueryClientProvider>,
    );
  });
  await vidangerLaFile();

  return {
    demonter: async () => {
      await act(async () => { arbre.unmount(); });
      queryClient.clear();
    },
    vues,
  };
};

/**
 * L'etat que le bandeau afficherait au dernier rendu.
 * @param {any[]} vues - Le carnet de la sonde.
 * @returns {string | null} `present`, `absent`, `pending`, ou `null`.
 */
const dernierEtat = (vues) => vues[vues.length - 1].answer;

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  /** @type {any} */ (Alert.alert).mockRestore();
});

describe('T02 temoin 1 — appuyer sur « Présent » ENVOIE la reponse, et ne navigue pas', () => {
  it("LE TEMOIN : le geste part vers le serveur, avec l'evenement et la reponse", async () => {
    getEventById.mockResolvedValue(SANS_REPONSE);
    respondToEventRsvp.mockResolvedValue({ success: true });
    const { demonter, vues } = await monterLaSonde();

    await act(async () => { vues[vues.length - 1].submit('present'); });
    await vidangerLaFile();

    expect(respondToEventRsvp).toHaveBeenCalledTimes(1);
    expect(respondToEventRsvp).toHaveBeenCalledWith(EVENEMENT_ID, 'present');
    await demonter();
  });

  it('« Absent » emprunte EXACTEMENT le meme tuyau, avec l autre reponse', async () => {
    getEventById.mockResolvedValue(SANS_REPONSE);
    respondToEventRsvp.mockResolvedValue({ success: true });
    const { demonter, vues } = await monterLaSonde();

    await act(async () => { vues[vues.length - 1].submit('absent'); });
    await vidangerLaFile();

    expect(respondToEventRsvp).toHaveBeenCalledWith(EVENEMENT_ID, 'absent');
    await demonter();
  });

  it('temoin 1 bis — les deux boutons du JOUEUR ne font plus AUCUNE navigation', () => {
    // Le defaut d'origine, nomme : les deux actions du joueur appelaient
    // `handleOpenEvent`, la fonction que S06 avait posee pour OUVRIR l'evenement.
    const debut = SOURCE_HUB.indexOf("key: 'present'");
    expect(debut).toBeGreaterThan(-1);
    const finBloc = SOURCE_HUB.indexOf('label: ', SOURCE_HUB.indexOf("key: 'absent'"));
    const blocJoueur = SOURCE_HUB.slice(debut, finBloc);

    expect(blocJoueur).not.toContain('handleOpenEvent');
    expect(blocJoueur).not.toContain('navigation.navigate');
    expect(blocJoueur).not.toContain('RouteNames.');
  });
});

describe('T02 temoin 2 — le bouton montre l ETAT REEL, celui que le serveur a confirme', () => {
  it("LE TEMOIN : avant la reponse le bandeau n'affiche AUCUN etat", async () => {
    getEventById.mockResolvedValue(SANS_REPONSE);
    const { demonter, vues } = await monterLaSonde();

    expect(dernierEtat(vues)).toBeNull();
    await demonter();
  });

  it('apres la reponse, l etat vient d une RELECTURE du serveur, pas du geste', async () => {
    // 1er appel : je n'ai pas repondu. 2e appel (apres la reponse) : le serveur
    // dit « accepted ». C'est CETTE relecture qui allume le bouton — jamais le
    // tap. Un bouton qui s'allumerait sans elle serait un mensonge (interdit n°1).
    getEventById
      .mockResolvedValueOnce(SANS_REPONSE)
      .mockResolvedValue(REPONDU_PRESENT);
    respondToEventRsvp.mockResolvedValue({ success: true });
    const { demonter, vues } = await monterLaSonde();

    await act(async () => { vues[vues.length - 1].submit('present'); });
    await vidangerLaFile();

    expect(getEventById.mock.calls.length).toBeGreaterThan(1);
    expect(dernierEtat(vues)).toBe('present');
    await demonter();
  });

  it('« Absent » confirme rend bien « absent », pas « present »', async () => {
    getEventById
      .mockResolvedValueOnce(SANS_REPONSE)
      .mockResolvedValue(REPONDU_ABSENT);
    respondToEventRsvp.mockResolvedValue({ success: true });
    const { demonter, vues } = await monterLaSonde();

    await act(async () => { vues[vues.length - 1].submit('absent'); });
    await vidangerLaFile();

    expect(dernierEtat(vues)).toBe('absent');
    await demonter();
  });

  it("une reponse « present » qui attend le staff s'annonce « pending », pas « present »", async () => {
    // `validationMode` vaut `manual` par DEFAUT cote serveur : repondre
    // « present » sur un evenement ordinaire cree une demande `pending`, pas une
    // participation. Le bandeau ne doit pas la peindre en presence acquise.
    const enAttente = {
      ...SANS_REPONSE,
      participationRequests: [{
        documentId: 'part-1', isActive: true, participationStatus: 'pending', user: MOI,
      }],
    };
    getEventById.mockResolvedValue(enAttente);
    const { demonter, vues } = await monterLaSonde();

    expect(dernierEtat(vues)).toBe('pending');
    await demonter();
  });
});

describe('T02 temoin 3 — si la reponse ECHOUE, le bouton revient comme avant ET l ecran le dit', () => {
  it('LE TEMOIN : apres un refus du serveur, l etat affiche est celui d AVANT', async () => {
    getEventById.mockResolvedValue(SANS_REPONSE);
    respondToEventRsvp.mockRejectedValue(new Error('boom'));
    const { demonter, vues } = await monterLaSonde();

    await act(async () => { vues[vues.length - 1].submit('present'); });
    await vidangerLaFile();

    // 🚨 Le temoin le plus important du lot : un bouton qui reste vert sur un
    // echec est un mensonge. Ici il ne peut pas mentir — il n'affiche QUE ce que
    // la relecture du serveur dit, et elle dit toujours « pas de reponse ».
    expect(dernierEtat(vues)).toBeNull();
    await demonter();
  });

  it("et l'ecran le DIT — l'echec n'est jamais silencieux", async () => {
    getEventById.mockResolvedValue(SANS_REPONSE);
    respondToEventRsvp.mockRejectedValue(new Error('boom'));
    const { demonter, vues } = await monterLaSonde();

    await act(async () => { vues[vues.length - 1].submit('present'); });
    await vidangerLaFile();

    expect(Alert.alert).toHaveBeenCalledTimes(1);
    await demonter();
  });

  it('les boutons se reactivent : un echec ne laisse pas le bandeau bloque', async () => {
    getEventById.mockResolvedValue(SANS_REPONSE);
    respondToEventRsvp.mockRejectedValue(new Error('boom'));
    const { demonter, vues } = await monterLaSonde();

    await act(async () => { vues[vues.length - 1].submit('present'); });
    await vidangerLaFile();

    expect(vues[vues.length - 1].isAnswering).toBe(false);
    await demonter();
  });
});

describe('T02 temoin 4 — le bandeau et la fiche de l evenement lisent LA MEME chose', () => {
  it('LE TEMOIN : les deux passent par la meme fonction de lecture d etat', () => {
    // La fiche (`EventAnswerButtons`, monte par EventDetails) et le bandeau
    // appellent tous deux `resolveRsvpAnswer`. Une seule regle, deux lecteurs :
    // ils ne PEUVENT pas se contredire.
    expect(SOURCE_BOUTONS).toContain('resolveRsvpAnswer');
    expect(SOURCE_HOOK).toContain('resolveRsvpAnswer');
  });

  it('et sur la MEME donnee : une seule entree de cache pour les deux ecrans', () => {
    // `useGetEvent` porte la clef `['event', documentId]`. EventDetails l'emploie
    // deja (EventDetails.js:599) ; le bandeau l'emploie aussi. React Query ne
    // garde qu'UNE entree pour cette clef — les deux ecrans lisent le meme octet.
    // ⇒ le hook DELEGUE sa lecture, il ne declare aucune query a lui.
    expect(SOURCE_HOOK).toContain('useGetEvent');
    expect(SOURCE_HOOK).not.toContain('useQuery(');
  });

  it("le bandeau n'ecrit AUCUNE seconde regle de reponse : il appelle celle qui existe", () => {
    // `respondToEventRsvp` est le tuyau que la reponse rapide des notifications
    // (`rsvpActions.js`) et les boutons de journee de stage empruntent deja. Le
    // hook passe par LUI, jamais par le client HTTP en direct.
    expect(SOURCE_HOOK).toContain('respondToEventRsvp');
    expect(SOURCE_HOOK).not.toContain('client.post');
    expect(SOURCE_HOOK).not.toContain("from '@/services/client'");
  });
});

describe('T02 temoin 5 — les autres variantes du bandeau continuent de MENER a l evenement', () => {
  it('LE TEMOIN : la ligne du dirigeant ouvre toujours l evenement (S06)', () => {
    const debut = SOURCE_HUB.indexOf('prochainEvenement: {');
    expect(debut).toBeGreaterThan(-1);
    const ligne = SOURCE_HUB.slice(debut, SOURCE_HUB.indexOf('\n        },', debut));

    expect(ligne).toContain('handleOpenEvent');
  });

  it("le bouton « Ouvrir la compo » de l'entraineur ouvre toujours l'evenement (S06)", () => {
    const debut = SOURCE_HUB.indexOf("key: 'compo'");
    expect(debut).toBeGreaterThan(-1);
    const bloc = SOURCE_HUB.slice(debut, debut + 400);

    expect(bloc).toContain('handleOpenEvent(seance.id)');
  });
});
