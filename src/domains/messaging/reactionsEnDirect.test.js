import fs from 'fs';
import path from 'path';

import { memo } from 'react';
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';
// 🧱 LE MEME MODULE QUE GIFTEDCHAT, pas un equivalent : `lodash.isequal`, celui
// qu'il importe a la ligne 3 de `Message/index.js`.
import isEqual from 'lodash.isequal';

import { withReactionsOnMessages } from '@/domains/messaging/reactionUseCases';

// `_id` est le nom impose par GiftedChat a ses messages : ce banc le reprend tel quel.
/* eslint-disable no-underscore-dangle */

// WHATSAPP3 — 🧨 « JE METS UN EMOJI EN REACTION, IL NE SE PASSE RIEN ».
//
// Defaut vu par Adel en PRODUCTION sur la 2.6.57. Le serveur enregistrait bien
// (deux lignes en base, prouvees par le chef d'orchestre), la reponse avait la
// bonne forme, le cache etait mis a jour — et pourtant AUCUNE bulle ne bougeait.
// La reaction n'apparaissait qu'en rouvrant la conversation.
//
// 🔎 LA CAUSE, lue dans la bibliotheque : GiftedChat enveloppe chaque bulle dans
// `memo(...)` avec un comparateur qui ne redessine QUE si `shouldUpdateMessage`
// dit oui, ou si `currentMessage` / `previousMessage` / `nextMessage` ont change
// (comparaison PROFONDE). Or l'ecran ne passait ni `shouldUpdateMessage` ni
// `extraData`, et les reactions vivaient HORS des objets message, dans un index
// a cote. Rien ne changeait dans les props de la bulle : elle restait telle
// quelle, indefiniment.
//
// ⚠️ CE QUE CE FICHIER MONTE, ET CE QU'IL NE MONTE PAS. Jest ne transforme pas
// `react-native-gifted-chat` (il n'est pas dans `transformIgnorePatterns`), et
// l'y ajouter ralentirait TOUTE la suite pour un seul test. Ce temoin rejoue
// donc le comparateur EXACT de la bibliotheque, avec le meme `lodash.isequal` —
// et un dernier test LIT le fichier de la bibliotheque pour verifier que ce
// comparateur est toujours celui-la. Si GiftedChat change sa memoisation, c'est
// ce test-la qui rougira.

const CHEMIN_GIFTED = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  'node_modules',
  'react-native-gifted-chat',
  'lib',
  'Message',
  'index.js',
);

/**
 * Le comparateur de GiftedChat, recopie a l'identique de `Message/index.js`.
 * @param {any} props Les props actuelles.
 * @param {any} nextProps Les suivantes.
 * @returns {boolean} Vrai pour NE PAS redessiner (convention de `memo`).
 */
const commeGiftedChat = (props, nextProps) => {
  const shouldUpdate = props.shouldUpdateMessage?.(props, nextProps)
    || !isEqual(props.currentMessage, nextProps.currentMessage)
    || !isEqual(props.previousMessage, nextProps.previousMessage)
    || !isEqual(props.nextMessage, nextProps.nextMessage);
  if (shouldUpdate) return false;
  return true;
};

/**
 * Un message du fil, au format GiftedChat.
 * @param id
 * @param texte
 */
const message = (/** @type {string} */ id, /** @type {string} */ texte) => ({
  _id: id,
  createdAt: new Date('2026-09-23T11:00:00.000Z'),
  documentId: id,
  text: texte,
  user: { _id: 'lui', name: 'Bruno' },
});

/**
 * Monte une bulle memorisee comme celle de GiftedChat et compte ses rendus.
 * @returns {{Bulle: any, rendus: any[]}} Le composant et son compteur.
 */
const fabriquerBulle = () => {
  const rendus = [];
  /**
   * La bulle nue : elle note chaque rendu, puis affiche le texte.
   * @param {any} proprietes Les props que GiftedChat passerait.
   * @returns {any} Le texte du message.
   */
  function Brute({ currentMessage }) {
    rendus.push(currentMessage.reactions?.length ?? 0);
    return <Text>{currentMessage.text}</Text>;
  }
  return { Bulle: memo(Brute, commeGiftedChat), rendus };
};

describe('WHATSAPP3 — une reaction se voit TOUT DE SUITE sous la bulle', () => {
  it('🪤 LE PIEGE : une bulle dont l objet ne change pas ne se redessine JAMAIS', () => {
    const { Bulle, rendus } = fabriquerBulle();
    const msg = message('m1', 'Salut');

    let arbre;
    act(() => { arbre = renderer.create(<Bulle currentMessage={msg} />); });
    expect(rendus).toHaveLength(1);

    // Le parent se redessine, mais avec EXACTEMENT le meme objet message.
    act(() => { arbre.update(<Bulle currentMessage={msg} />); });

    // ⛔ Toujours un seul rendu. C'est la memoisation — et c'est le defaut
    // d'Adel : tant que l'objet ne change pas, la reaction n'apparait pas.
    expect(rendus).toHaveLength(1);
  });

  it('✅ une reaction qui arrive fait redessiner LA bulle du message vise', () => {
    const { Bulle, rendus } = fabriquerBulle();
    const avant = [message('m1', 'Salut'), message('m2', 'Ca va ?')];
    const apres = withReactionsOnMessages(avant, {
      m2: [{ count: 1, emoji: '\u{1F44D}', users: [] }],
    });
    const vise = (/** @type {any[]} */ liste) => liste.find((m) => m._id === 'm2');

    let arbre;
    act(() => { arbre = renderer.create(<Bulle currentMessage={vise(avant)} />); });
    expect(rendus).toEqual([0]);

    act(() => { arbre.update(<Bulle currentMessage={vise(apres)} />); });

    // 🎯 LE COEUR DU LOT : la bulle s'est redessinee, et elle porte la reaction.
    expect(rendus).toEqual([0, 1]);
  });

  it('✅ les AUTRES messages ne se redessinent pas : un pouce ne refabrique pas le fil', () => {
    const { Bulle, rendus } = fabriquerBulle();
    const avant = [message('m1', 'Salut'), message('m2', 'Ca va ?')];
    const apres = withReactionsOnMessages(avant, {
      m2: [{ count: 1, emoji: '\u{1F44D}', users: [] }],
    });
    const intact = (/** @type {any[]} */ liste) => liste.find((m) => m._id === 'm1');

    let arbre;
    act(() => { arbre = renderer.create(<Bulle currentMessage={intact(avant)} />); });
    act(() => { arbre.update(<Bulle currentMessage={intact(apres)} />); });

    // Le message SANS reaction garde son objet a l'identique : aucun rendu de plus.
    expect(rendus).toHaveLength(1);
  });

  it('une reaction RETIREE fait aussi redessiner la bulle', () => {
    const { Bulle, rendus } = fabriquerBulle();
    const base = [message('m1', 'Salut')];
    const avec = withReactionsOnMessages(base, {
      m1: [{ count: 1, emoji: '\u{1F44D}', users: [] }],
    });
    const sans = withReactionsOnMessages(base, {});

    let arbre;
    act(() => { arbre = renderer.create(<Bulle currentMessage={avec[0]} />); });
    act(() => { arbre.update(<Bulle currentMessage={sans[0]} />); });

    expect(rendus).toEqual([1, 0]);
  });

  it('la fusion garde la MEME reference pour les messages sans reaction', () => {
    const avant = [message('m1', 'Salut'), message('m2', 'Ca va ?')];
    const apres = withReactionsOnMessages(avant, {
      m2: [{ count: 1, emoji: '\u{1F44D}', users: [] }],
    });

    expect(apres[0]).toBe(avant[0]);
    expect(apres[1]).not.toBe(avant[1]);
    expect(apres[1].reactions).toHaveLength(1);
  });

  it('sans aucune reaction, elle rend la liste D ORIGINE, sans la recopier', () => {
    const avant = [message('m1', 'Salut')];

    expect(withReactionsOnMessages(avant, {})).toBe(avant);
    expect(withReactionsOnMessages(avant, null)).toBe(avant);
  });

  it('ne rend jamais rien d absurde quand on ne lui donne rien', () => {
    expect(withReactionsOnMessages(null, null)).toEqual([]);
    expect(withReactionsOnMessages(undefined, {})).toEqual([]);
  });

  it('🔒 GiftedChat memorise TOUJOURS ses bulles de la meme facon', () => {
    // Si cette lecture rougit, c'est que la bibliotheque a change sa
    // memoisation : la correction ci-dessus doit alors etre reexaminee.
    const source = fs.readFileSync(CHEMIN_GIFTED, 'utf8');

    expect(source).toMatch(/memo\(Message,\s*\(props,\s*nextProps\)\s*=>/);
    expect(source).toMatch(/!isEqual\(props\.currentMessage,\s*nextProps\.currentMessage\)/);
    expect(source).toMatch(/props\.shouldUpdateMessage\?\.\(props,\s*nextProps\)/);
  });
});
