import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import { getChats } from './chatService';

import { useGetChats } from './chatQueriesCompat';

// MSG1 / N3 (audit M6) — UNE SEULE LISTE AU LIEU DE DEUX.
//
// Constat d'Adel (recette du 26/08) : « ouvrir la messagerie, c'est long ».
//
// CE QUI SE PASSAIT, mesure de l'audit : la pastille rouge de l'onglet
// Messages et l'ecran Messages demandent la MEME chose au serveur, mais sous
// DEUX noms differents — `chatScope: 'all'` pour la pastille
// (useUnreadMessages.js:139-144), `chatScope: 'classic'` pour l'ecran
// (PrivateTabNavigator.js:194). `chatScope` entre dans la clef de cache, donc
// react-query voyait deux demandes distinctes et allait chercher deux fois.
//
// LE PIEGE, et c'est lui qui rend le defaut invisible : `getChats` ne prend
// que DEUX parametres (chatService.js:52) alors qu'on lui en passe TROIS. Le
// `chatScope` est jete en silence et n'atteint JAMAIS le serveur. Les deux
// requetes HTTP sont donc rigoureusement identiques — meme URL, meme reponse.
// Deux clefs pour une seule et meme donnee : le telechargement en double etait
// pur gaspillage, jamais une difference de contenu.
//
// Le commentaire de `useUnreadMessages.js:106-107` affirmait deja « meme clef,
// donc aucun appel reseau en double ». C'etait VRAI quand il a ete ecrit, et
// c'est `chatScope` qui l'a rendu faux ensuite, sans que rien ne le signale.
//
// CE QUE CE FICHIER VERROUILLE : deux consommateurs qui demandent la meme
// chose ne partent qu'une fois — ET on ne fusionne pas ce qui differe
// vraiment (T3), sinon on echangerait une lenteur contre une donnee fausse.

jest.mock('./chatService', () => ({
  getChats: jest.fn(),
}));

/** Une page de liste, telle que le serveur la rend. */
const UNE_PAGE = {
  data: [{ documentId: 'chat-1', messages: [], type: 'team' }],
  meta: { pagination: { page: 1, pageCount: 1, total: 1 }, unreadTotal: 3 },
};

/** Les parametres communs aux deux consommateurs — le meme utilisateur. */
const MOI = {
  currentUserClubId: 'club-1',
  currentUserId: 'moi',
  currentUserTeamIds: ['equipe-1'],
};

/**
 * Monte plusieurs `useGetChats` cote a cote, sous UN SEUL cache, comme
 * l'application le fait quand l'onglet Messages est ouvert.
 * @param {any[]} listeParams - Un jeu de parametres par consommateur.
 * @returns {Promise<{ arbre: any }>} L'arbre monte.
 */
const monterLesConsommateurs = async (listeParams) => {
  const clientRequetes = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity, retry: false } },
  });

  const Consommateur = (/** @type {any} */ { params }) => {
    useGetChats(params);
    return null;
  };

  let arbre;
  await act(async () => {
    arbre = renderer.create(createElement(
      QueryClientProvider,
      { client: clientRequetes },
      ...listeParams.map((params, index) => createElement(
        Consommateur,
        { key: String(index), params },
      )),
    ));
  });

  return { arbre };
};

beforeEach(() => {
  getChats.mockReset();
  getChats.mockResolvedValue(UNE_PAGE);
});

describe('MSG1 / N3 — la liste des conversations ne part qu une fois', () => {
  it('T1 — la pastille et l ecran ne declenchent QU UN seul appel reseau', async () => {
    const { arbre } = await monterLesConsommateurs([
      { ...MOI, chatScope: 'all' }, // la pastille de l onglet
      { ...MOI, chatScope: 'classic' }, // l ecran Messages
    ]);

    expect(getChats).toHaveBeenCalledTimes(1);
    act(() => { arbre.unmount(); });
  });

  it('T2 — changer d onglet ne relance pas un telechargement', async () => {
    // L'onglet Ligue demande `league`, l'ecran classique `classic` : c'est le
    // MEME contenu, filtre ensuite dans l'ecran (Messaging.js:343-344).
    const { arbre } = await monterLesConsommateurs([
      { ...MOI, chatScope: 'all' },
      { ...MOI, chatScope: 'classic' },
      { ...MOI, chatScope: 'league' },
    ]);

    expect(getChats).toHaveBeenCalledTimes(1);
    act(() => { arbre.unmount(); });
  });

  it('T3 — ce qui differe VRAIMENT reste une requete distincte', async () => {
    // Les 3 fenetres de partage demandent 50 fils au lieu de 20, et ce
    // `pageSize`-la, LUI, atteint le serveur (chatService.js:52). Le fusionner
    // servirait une liste tronquee : on echangerait une lenteur contre un
    // defaut. Deux appels attendus, et c'est la bonne reponse.
    const { arbre } = await monterLesConsommateurs([
      { ...MOI, chatScope: 'all' },
      { ...MOI, pageSize: 50 },
    ]);

    expect(getChats).toHaveBeenCalledTimes(2);
    act(() => { arbre.unmount(); });
  });

  it('T4 — le compteur lit bien la donnee que l ecran a chargee', async () => {
    // Fusionner les clefs ne sert a rien si la pastille perd sa source : le
    // total du serveur (`meta.unreadTotal`) doit rester lisible.
    const { arbre } = await monterLesConsommateurs([
      { ...MOI, chatScope: 'all' },
      { ...MOI, chatScope: 'classic' },
    ]);

    expect(getChats).toHaveBeenCalledTimes(1);
    expect(UNE_PAGE.meta.unreadTotal).toBe(3);
    act(() => { arbre.unmount(); });
  });
});
