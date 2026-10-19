import {
  CANAL_DIRIGEANTS,
  CANAL_VILLE,
  CONVERSATION_CLUB,
  estFilDeLaVille,
  estRefusDuFilDeLaVille,
  filsDeLaMessagerie,
  peutEcrireDansLeFil,
  placeholderDuFil,
  routeDeLaLigne,
  signatureDuMessage,
  sousTitreDuFil,
  texteDeLaLigne,
  titreDuFil,
  voixDuFil,
} from '@/domains/collectivite/collectiviteCanaux';

// COLL-C4A2 (02/10) — les règles d'affichage des canaux de la Ville, sans réseau.
const t = (/** @type {string} */ _cle, /** @type {string} */ repli, /** @type {any} */ options) => (
  String(repli).replace(/\{\{(\w+)\}\}/g, (_tout, nom) => String(options?.[nom] ?? ''))
);
const VILLE = { documentId: 'ville-1', name: 'Ville de Montrivage' };
const CLUB = { documentId: 'club-fc', name: 'Montrivage FC' };
const CANAL = { collectivite: VILLE, documentId: 'canal-1', type: CANAL_DIRIGEANTS };
const PRIVEE = {
  collectivite: VILLE, collectiviteClub: CLUB, documentId: 'privee-1', type: CONVERSATION_CLUB,
};

describe('COLL-C4A2 — les canaux de la Ville, en règles pures', () => {
  it('reconnaît les deux fils de la Ville, et eux seuls', () => {
    expect(estFilDeLaVille(CANAL)).toBe(true);
    expect(estFilDeLaVille(PRIVEE)).toBe(true);
    expect(estFilDeLaVille({ type: 'club' })).toBe(false);
    expect(estFilDeLaVille(null)).toBe(false);
  });

  it('le titre : « Dirigeants des clubs » ; la conversation privée porte le nom d’en face', () => {
    expect(titreDuFil(t, { chat: CANAL, espaceVille: true })).toBe('Dirigeants des clubs');
    expect(titreDuFil(t, { chat: PRIVEE, espaceVille: true })).toBe('Montrivage FC');
    expect(titreDuFil(t, { chat: PRIVEE, espaceVille: false })).toBe('Ville de Montrivage');
    expect(titreDuFil(t, { chat: { type: 'team' }, espaceVille: false })).toBe('');
  });

  it('le sous-titre : « vous » pour la mairie, la Ville et ses clubs pour un dirigeant', () => {
    expect(sousTitreDuFil(t, { chat: CANAL, clubsCount: 3, espaceVille: true }))
      .toBe('Vous et les dirigeants des 3 clubs');
    expect(sousTitreDuFil(t, { chat: CANAL, clubsCount: 1, espaceVille: true }))
      .toBe('Vous et les dirigeants d’1 club');
    expect(sousTitreDuFil(t, { chat: CANAL, clubsCount: 3, espaceVille: false }))
      .toBe('Ville de Montrivage et 3 clubs');
    expect(sousTitreDuFil(t, { chat: PRIVEE, espaceVille: true }))
      .toBe('Vous et les dirigeants du club');
    expect(sousTitreDuFil(t, { chat: PRIVEE, espaceVille: false }))
      .toBe('Conversation privée avec la Ville');
  });

  it('chaque message dit qui écrit ET pour quel club', () => {
    const karim = { firstname: 'Karim', lastname: 'Benali' };
    const ville = { nom: 'Ville de Montrivage', voix: 'ville' };
    const club = { nom: 'AS Montrivage', voix: 'club' };
    expect(signatureDuMessage(t, { sender: karim, senderSignature: ville }))
      .toBe('Ville de Montrivage · Karim B.');
    expect(signatureDuMessage(t, { sender: karim, senderSignature: club }))
      .toBe('Karim Benali · AS Montrivage');
    expect(signatureDuMessage(t, { sender: karim })).toBeNull();
  });

  it('le champ d’écriture et la voix demandée au serveur', () => {
    expect(placeholderDuFil(t, { chat: CANAL, espaceVille: true })).toBe('Écrire aux dirigeants…');
    expect(placeholderDuFil(t, { chat: CANAL, espaceVille: false }))
      .toBe('Écris aux autres dirigeants…');
    expect(placeholderDuFil(t, { chat: PRIVEE, espaceVille: true }))
      .toBe('Écrire à Montrivage FC…');
    expect(placeholderDuFil(t, { chat: PRIVEE, espaceVille: false })).toBe('Écris à la Ville…');
    expect(placeholderDuFil(t, { chat: { type: 'team' }, espaceVille: true })).toBeNull();
    expect(voixDuFil({ chat: CANAL, espaceVille: true }))
      .toEqual({ senderSignature: { voix: 'ville' } });
    expect(voixDuFil({ chat: CANAL, espaceVille: false })).toEqual({});
    expect(voixDuFil({ chat: { type: 'team' }, espaceVille: true })).toEqual({});
  });

  // R17-CANAUX (19/10, REC17-004, Adel : « le canal des dirigeants doit être comme les autres ») —
  // RÉÉCRIT : dans l'espace de la Ville, le canal des dirigeants n'est plus une carte épinglée au
  // dessus de la liste, c'est une ligne de conversation ordinaire (on l'épingle, on l'archive).
  it('la liste : l’espace de la Ville, SES conversations ET son canal des dirigeants', () => {
    const filClub = { club: { documentId: 'club-x' }, documentId: 'club-chat', type: 'club' };
    const autreClub = {
      ...PRIVEE, collectiviteClub: { documentId: 'club-b', name: 'Basket' }, documentId: 'privee-2',
    };
    const autreVille = {
      ...PRIVEE,
      collectivite: { documentId: 'ville-2' },
      collectiviteClub: { documentId: 'club-c', name: 'FC Voisin' },
      documentId: 'privee-3',
    };
    const canalAutreVille = {
      ...CANAL, collectivite: { documentId: 'ville-2' }, documentId: 'canal-2',
    };
    const tous = [CANAL, PRIVEE, autreClub, autreVille, filClub, canalAutreVille];
    const ids = (/** @type {any[]} */ liste) => liste.map((c) => c.documentId);
    expect(ids(filsDeLaMessagerie(tous, { collectiviteId: 'ville-1', espaceVille: true })))
      .toEqual(['canal-1', 'privee-1', 'privee-2']);
    // Côté club : le canal sort de la liste, et seule la conversation privée de SON club reste.
    expect(ids(filsDeLaMessagerie(tous, { espaceVille: false, monClubId: 'club-fc' })))
      .toEqual(['privee-1', 'club-chat']);
  });

  // 🏛️ R17-CANAUX (19/10, REC17-004, point 5) — « TOUTE LA VILLE » (`collectivite_ville`) : une
  // ligne de conversation ; dedans, la Ville écrit, ses membres lisent (« Seule la Ville écrit
  // ici »), personne ne voit qui le lit.
  describe('R17-CANAUX — « Toute la ville »', () => {
    const TOUTE = { collectivite: VILLE, documentId: 'ville-canal', type: CANAL_VILLE };

    it('un fil de la Ville, avec son titre et un NOMBRE pour sous-titre', () => {
      expect(CANAL_VILLE).toBe('collectivite_ville');
      expect(estFilDeLaVille(TOUTE)).toBe(true);
      expect(titreDuFil(t, { chat: TOUTE, espaceVille: true })).toBe('Toute la ville');
      expect(titreDuFil(t, { chat: TOUTE, espaceVille: false }))
        .toBe('Toute la ville · Ville de Montrivage');
      expect(sousTitreDuFil(t, { chat: TOUTE, clubsCount: 3, espaceVille: true }))
        .toBe('Lu par les membres des 3 clubs');
      expect(sousTitreDuFil(t, { chat: TOUTE, clubsCount: 1, espaceVille: false }))
        .toBe('Lu par les membres d’1 club');
    });

    it('écrire : la Ville seule ; les autres fils de la Ville, tous leurs membres', () => {
      expect(peutEcrireDansLeFil({ chat: TOUTE, espaceVille: true })).toBe(true);
      expect(peutEcrireDansLeFil({ chat: TOUTE, espaceVille: false })).toBe(false);
      // Un compte mixte qui l'ouvre depuis son club : le serveur dit s'il gère la Ville.
      const mixte = { chat: TOUTE, espaceVille: false, membres: { peutEcrire: true } };
      expect(peutEcrireDansLeFil(mixte)).toBe(true);
      expect(peutEcrireDansLeFil({ chat: CANAL, espaceVille: false })).toBe(true);
      expect(peutEcrireDansLeFil({ chat: PRIVEE, espaceVille: false })).toBe(true);
      expect(placeholderDuFil(t, { chat: TOUTE, espaceVille: true }))
        .toBe('Écrire à toute la ville…');
      expect(voixDuFil({ chat: TOUTE, espaceVille: true }))
        .toEqual({ senderSignature: { voix: 'ville' } });
    });

    it('la liste : en tête chez le membre, dans l’espace de SA Ville seulement', () => {
      const ailleurs = {
        ...TOUTE, collectivite: { documentId: 'ville-2' }, documentId: 'ville-canal-2',
      };
      const tous = [PRIVEE, TOUTE, ailleurs];
      const ids = (/** @type {any[]} */ liste) => liste.map((c) => c.documentId);
      expect(ids(filsDeLaMessagerie(tous, { collectiviteId: 'ville-1', espaceVille: true })))
        .toEqual(['privee-1', 'ville-canal']);
      expect(ids(filsDeLaMessagerie(tous, { espaceVille: false, monClubId: 'club-x' })))
        .toEqual(['ville-canal', 'ville-canal-2']);
    });

    it('une actualité posée mène à elle (le membre : son canal ; la Ville : sa liste)', () => {
      const ligne = {
        message: 'Nouvelle actualité de la Ville : « Dojo fermé »',
        sender: null,
        systemNotice: {
          actualite: { documentId: 'actu-1', title: 'Dojo fermé' },
          collectivite: { documentId: 'ville-1' },
          kind: 'collectivite_actualite',
          version: 1,
        },
      };
      expect(routeDeLaLigne({ espaceVille: false, message: ligne })).toEqual({
        name: 'CollectiviteActualitesCanal',
        params: { actualiteId: 'actu-1', collectiviteId: 'ville-1' },
      });
      expect(routeDeLaLigne({ espaceVille: true, message: ligne })).toEqual({
        name: 'CollectiviteActualites',
        params: { collectiviteId: 'ville-1' },
      });
      expect(texteDeLaLigne(t, ligne)).toBe('Nouvelle actualité de la Ville : « Dojo fermé »');
      const arrivee = { message: 'X a rejoint le canal', sender: null };
      expect(routeDeLaLigne({ message: arrivee })).toBeNull();
      expect(routeDeLaLigne({ message: { ...ligne, systemNotice: { kind: 'group_created' } } }))
        .toBeNull();
    });
  });

  it('reconnaît le refus « tu ne fais plus partie de ce canal »', () => {
    expect(estRefusDuFilDeLaVille({
      response: { data: { error: { details: { code: 'COLLECTIVITE_CANAL_NOT_MEMBER' } } } },
    })).toBe(true);
    expect(estRefusDuFilDeLaVille({ response: { status: 500 } })).toBe(false);
    expect(estRefusDuFilDeLaVille(null)).toBe(false);
  });
});
