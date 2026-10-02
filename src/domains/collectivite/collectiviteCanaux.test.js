import {
  CANAL_DIRIGEANTS,
  CONVERSATION_CLUB,
  estFilDeLaVille,
  estRefusDuFilDeLaVille,
  filsDeLaMessagerie,
  placeholderDuFil,
  signatureDuMessage,
  sousTitreDuFil,
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

  it('la liste : canal épinglé ailleurs ; l’espace de la Ville, SES conversations privées', () => {
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
    const tous = [CANAL, PRIVEE, autreClub, autreVille, filClub];
    const ids = (/** @type {any[]} */ liste) => liste.map((c) => c.documentId);
    expect(ids(filsDeLaMessagerie(tous, { collectiviteId: 'ville-1', espaceVille: true })))
      .toEqual(['privee-1', 'privee-2']);
    // Côté club : le canal sort de la liste, et seule la conversation privée de SON club reste.
    expect(ids(filsDeLaMessagerie(tous, { espaceVille: false, monClubId: 'club-fc' })))
      .toEqual(['privee-1', 'club-chat']);
  });

  it('reconnaît le refus « tu ne fais plus partie de ce canal »', () => {
    expect(estRefusDuFilDeLaVille({
      response: { data: { error: { details: { code: 'COLLECTIVITE_CANAL_NOT_MEMBER' } } } },
    })).toBe(true);
    expect(estRefusDuFilDeLaVille({ response: { status: 500 } })).toBe(false);
    expect(estRefusDuFilDeLaVille(null)).toBe(false);
  });
});
