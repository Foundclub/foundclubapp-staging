import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';

import {
  buildMinorParentalDeclarationPayload,
  MINOR_PARENTAL_DECLARATION_SCOPE,
  MINOR_PARENTAL_DECLARATION_TEXT_HASH,
  MINOR_PARENTAL_DECLARATION_VERSION,
  MINOR_SELF_DECLARATION_TEXT,
  MINOR_SELF_DECLARATION_TEXT_HASH,
  MINOR_SELF_DECLARATION_VERSION,
  PARENTAL_DECLARATION_SIGNATORIES,
  parentalDeclarationTextFor,
} from '@/constants/parentalDeclaration';

// CONSENTEMENT-PHRASE (2026-10-01) — DECISION D'ADEL « 3-A CORRIGE ».
//
// ☠️ LE DEFAUT : un ado de 13-14 ans qui s'inscrit seul cochait « Je déclare être le
// parent ou le représentant legal de cet enfant et utiliser l application en son nom ».
// On lui faisait affirmer qu'il est son PROPRE parent, et le serveur l'enregistrait.
//
// 🎯 DEUX SIGNATAIRES, DEUX TEXTES :
//   · l'ado coche une phrase VRAIE pour lui (nouvelle version du texte legal) ;
//   · le parent qui signe depuis le lien (PARENT-LIEN) garde la sienne, inchangee.
// L'empreinte du texte de l'ado est controlee contre celle du SERVEUR par le temoin
// `SECUEVENT/V3 bis` du depot admin ; ici on controle qu'elle est celle du texte AFFICHE.

const sha256 = (/** @type {string} */ texte) => createHash('sha256').update(texte, 'utf8').digest('hex');

const RACINE_APP = path.resolve(__dirname, '..', '..', '..');

/**
 * Tous les fichiers source de `src/`, hors temoins.
 * @param {string} dossier - Le dossier a parcourir.
 * @returns {string[]} Les chemins absolus.
 */
const sources = (dossier) => fs.readdirSync(dossier, { withFileTypes: true }).flatMap((entree) => {
  const chemin = path.join(dossier, entree.name);
  if (entree.isDirectory()) return entree.name === '__tests__' ? [] : sources(chemin);
  return /\.(js|jsx|ts|tsx)$/.test(entree.name) && !/\.test\./.test(entree.name) ? [chemin] : [];
});

const relatif = (/** @type {string} */ absolu) => path.relative(RACINE_APP, absolu).split(path.sep).join('/');

test('S1 — la phrase de l ado est VRAIE pour lui : il ne declare plus etre le parent', () => {
  expect(MINOR_SELF_DECLARATION_TEXT).toBe(
    'Un de mes parents (ou mon représentant légal) m\'a donné son accord pour créer ce compte.',
  );
  expect(MINOR_SELF_DECLARATION_TEXT).not.toMatch(/être le parent|cet enfant|en son nom/i);
  expect(parentalDeclarationTextFor(PARENTAL_DECLARATION_SIGNATORIES.MINOR_SELF))
    .toBe(MINOR_SELF_DECLARATION_TEXT);
});

test('S2 — l empreinte et la version de l ado sont NEUVES et sont celles du texte affiche', () => {
  expect(sha256(MINOR_SELF_DECLARATION_TEXT)).toBe(MINOR_SELF_DECLARATION_TEXT_HASH);
  expect(MINOR_SELF_DECLARATION_TEXT_HASH).not.toBe(MINOR_PARENTAL_DECLARATION_TEXT_HASH);
  expect(MINOR_SELF_DECLARATION_VERSION).toBe('minor-parental-declaration-v2-self-2026-10-01');
});

test('S3 — par defaut, la preuve envoyee est celle de l ado : nouvelle version, nouvelle case', () => {
  const preuve = buildMinorParentalDeclarationPayload({ sourceScreen: 'onboarding_parental_declaration' });

  expect(preuve).toEqual(expect.objectContaining({
    accepted: true,
    consentFlags: { parentalPermissionObtained: true },
    legalTextHash: MINOR_SELF_DECLARATION_TEXT_HASH,
    legalVersion: MINOR_SELF_DECLARATION_VERSION,
    locale: 'fr-FR',
    scope: MINOR_PARENTAL_DECLARATION_SCOPE,
  }));
});

test('S4 — le parent garde SA declaration : texte, version et empreinte d avant', () => {
  const preuve = buildMinorParentalDeclarationPayload({
    signatory: PARENTAL_DECLARATION_SIGNATORIES.PARENT,
    sourceScreen: 'parent_link_request',
  });

  expect(preuve.legalVersion).toBe('minor-parental-declaration-v1-2026-05-14');
  expect(preuve.legalTextHash).toBe('42f52a118fe373ac50160c7676da639696723111fbf9e1c4c412d3f3f6c7adf2');
  expect(preuve.legalVersion).toBe(MINOR_PARENTAL_DECLARATION_VERSION);
  expect(preuve.consentFlags).toEqual({ parentalAuthorityConfirmation: true });
  expect(parentalDeclarationTextFor(PARENTAL_DECLARATION_SIGNATORIES.PARENT))
    .toMatch(/^Je déclare être le parent/);
});

test('S5 — CARTE DES APPELANTS : seul le lien parent fait signer le parent', () => {
  // Le module qui DEFINIT les constantes n'est pas un appelant : on le retire de la carte.
  const appelants = sources(path.join(RACINE_APP, 'src'))
    .map((absolu) => ({ chemin: relatif(absolu), texte: fs.readFileSync(absolu, 'utf8') }))
    .filter(({ chemin }) => chemin !== 'src/constants/parentalDeclaration.js')
    .filter(({ texte }) => /ParentalDeclarationCard|buildMinorParentalDeclarationPayload/.test(texte));
  const chemins = appelants.map(({ chemin }) => chemin);

  // Les parcours ou l'ADO coche (les 8 du comparatif passent tous par ces fichiers).
  expect(chemins).toEqual(expect.arrayContaining([
    'src/domains/playerCard/cardConsent.js',
    'src/views/onboarding/UserParentalDeclaration.js',
    'src/views/profile/PlayerCardScreen.js',
    'src/views/profile/ProfileEdit.js',
    'src/views/profile/ProfileEdit.web.js',
  ]));

  // ⛔ Le texte du parent n'est signe QUE depuis le lien parent.
  const signentCommeParent = appelants
    .filter(({ texte }) => /PARENTAL_DECLARATION_SIGNATORIES\.PARENT/.test(texte))
    .map(({ chemin }) => chemin)
    .sort();
  expect(signentCommeParent).toEqual([
    'src/services/parentLink/parentLinkService.js',
    'src/views/profile/ParentLinkInvite.js',
  ]);

  // ⛔ La phrase du parent n'est ecrite en dur nulle part ailleurs que dans les constantes.
  const phraseDuParentEnDur = sources(path.join(RACINE_APP, 'src'))
    .filter((absolu) => fs.readFileSync(absolu, 'utf8').includes('Je déclare être le parent'))
    .map(relatif);
  expect(phraseDuParentEnDur).toEqual(['src/constants/parentalDeclaration.js']);
});
