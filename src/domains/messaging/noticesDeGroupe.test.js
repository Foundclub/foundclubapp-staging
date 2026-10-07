import { texteDeLaNotice } from './noticesDeGroupe';

// MSG1BA (§3.17) — les notices de groupe ecrites pour le lecteur (contrat 1B §6) : « Vous »
// quand il en est l'auteur, « vous » quand il est vise ; une sorte inconnue garde la phrase
// du serveur.

const t = (/** @type {string} */ _cle, /** @type {any} */ repli) => {
  const gabarit = typeof repli === 'string' ? repli : repli?.defaultValue;
  return String(gabarit).replace(/\{\{(\w+)\}\}/g, (m, nom) => String(repli?.[nom] ?? m));
};

const ADEL = { documentId: 'moi', firstname: 'Adel', lastname: 'Ferchichi' };
const KARIM = { documentId: 'karim', firstname: 'Karim', lastname: 'Benali' };
const LEA = { documentId: 'lea', firstname: 'Léa', lastname: 'Morel' };

/**
 * Une notice, au format du serveur.
 * @param {string} kind
 * @param {Record<string, any>} [plus]
 * @returns {any}
 */
const notice = (kind, plus = {}) => ({
  actor: KARIM, kind, targets: [], version: 1, ...plus,
});

describe('texteDeLaNotice (§3.17)', () => {
  test('NV1 — j en suis l auteur : « Vous avez… »', () => {
    const renommage = notice('group_renamed', { actor: ADEL, groupName: 'Les U13 bis' });
    expect(texteDeLaNotice(renommage, 'moi', t))
      .toBe('Vous avez renommé le groupe en « Les U13 bis ».');
    expect(texteDeLaNotice(notice('group_created', { actor: ADEL, groupName: 'Covoit' }), 'moi', t))
      .toBe('Vous avez créé le groupe « Covoit ».');
    expect(texteDeLaNotice(notice('member_left', { actor: ADEL }), 'moi', t))
      .toBe('Vous avez quitté le groupe.');
    expect(texteDeLaNotice(notice('group_photo_changed', { actor: ADEL }), 'moi', t))
      .toBe('Vous avez changé la photo du groupe.');
  });

  test('NV2 — quelqu un d autre : la 3e personne, nom complet', () => {
    expect(texteDeLaNotice(notice('group_photo_removed'), 'moi', t))
      .toBe('Karim Benali a supprimé la photo du groupe.');
    expect(texteDeLaNotice(notice('member_added', { targets: [LEA] }), 'moi', t))
      .toBe('Karim Benali a ajouté Léa Morel.');
  });

  test('NV3 — je suis vise : « vous »', () => {
    expect(texteDeLaNotice(notice('member_added', { targets: [ADEL] }), 'moi', t))
      .toBe('Karim Benali vous a ajouté.');
    expect(texteDeLaNotice(notice('member_added', { targets: [LEA, ADEL] }), 'moi', t))
      .toBe('Karim Benali a ajouté Léa Morel et vous.');
    expect(texteDeLaNotice(notice('admin_added', { targets: [ADEL] }), 'moi', t))
      .toBe('Karim Benali vous a nommé admin du groupe.');
    expect(texteDeLaNotice(notice('admin_removed', { targets: [ADEL] }), 'moi', t))
      .toBe('Karim Benali vous a retiré le rôle d’admin.');
    expect(texteDeLaNotice(notice('member_removed', { targets: [ADEL] }), 'moi', t))
      .toBe('Karim Benali vous a retiré.');
  });

  test('NV4 — plusieurs admins nommes : le pluriel', () => {
    expect(texteDeLaNotice(notice('admin_added', { actor: ADEL, targets: [KARIM, LEA] }), 'moi', t))
      .toBe('Vous avez nommé Karim Benali et Léa Morel admins du groupe.');
  });

  test('NV5 — l heritier : « Vous devenez admin » / « Léa Morel devient admin »', () => {
    expect(texteDeLaNotice(notice('admin_inherited', { actor: null, targets: [ADEL] }), 'moi', t))
      .toBe('Vous devenez admin du groupe.');
    expect(texteDeLaNotice(notice('admin_inherited', { actor: null, targets: [LEA] }), 'moi', t))
      .toBe('Léa Morel devient admin du groupe.');
  });

  test('NV6 — une autorisation changee, selon la clef et la valeur', () => {
    expect(texteDeLaNotice(notice('permission_changed', {
      actor: ADEL, permission: { key: 'membersCanSendMessages', value: false },
    }), 'moi', t)).toBe('Vous avez réservé l’envoi de messages aux admins.');
    expect(texteDeLaNotice(notice('permission_changed', {
      permission: { key: 'membersCanEditName', value: true },
    }), 'moi', t)).toBe('Karim Benali a autorisé les membres à modifier le nom du groupe.');
  });

  test('NV8 — notice incomplete (sans auteur, sans nom de groupe) : la phrase du serveur', () => {
    const phrase = 'Adel a renommé le groupe en « Les U13 bis ».';
    expect(texteDeLaNotice({ kind: 'group_renamed', version: 1 }, 'moi', t, phrase)).toBe(phrase);
    expect(texteDeLaNotice(notice('group_renamed', { actor: ADEL }), 'moi', t, phrase))
      .toBe(phrase);
    expect(texteDeLaNotice(notice('member_added', { targets: [] }), 'moi', t, 'X a ajouté Y.'))
      .toBe('X a ajouté Y.');
  });

  test('NV7 — sorte inconnue ou notice absente : la phrase du serveur, telle quelle', () => {
    expect(texteDeLaNotice(notice('group_archived'), 'moi', t, 'Karim a archivé le groupe.'))
      .toBe('Karim a archivé le groupe.');
    expect(texteDeLaNotice(null, 'moi', t, 'Phrase du serveur.')).toBe('Phrase du serveur.');
  });
});
