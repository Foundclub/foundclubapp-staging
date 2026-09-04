import { readFileSync } from 'fs';
import { join } from 'path';

import { parse as parsePlist } from 'plist';

// PLIST (2026-09-04) — LE BINAIRE ET LA FICHE APP STORE NE DISAIENT PAS LA MEME CHOSE.
//
// 💸 CE QUE ÇA COÛTAIT : Apple genere un rapport de confidentialite a partir des
// manifestes embarques dans le binaire et le confronte aux reponses
// « Confidentialite de l app » d App Store Connect. Le 04/09, la fiche declarait
// 15 types de donnees et le binaire 10 : `CoarseLocation`, `AudioData`,
// `SearchHistory`, `PurchaseHistory`, `CrashData` et `Fitness` manquaient. Un
// ecart de cette taille se paie en refus de version.
//
// 🪤 LE PIEGE QUE CE TEMOIN COUVRE : les noms de types Apple sont des constantes
// EXACTES et sensibles a la casse (`NSPrivacyCollectedDataTypePhotosorVideos`
// prend un `or` minuscule au milieu). Une faute de frappe n est pas une erreur :
// elle est ignoree en silence, et le type n est simplement plus declare. D ou la
// liste officielle ci-dessous, confrontee a chaque execution.
//
// ⚠️ CE QUE CE FICHIER NE PROUVE PAS : Jest ne sait pas ce qu Apple a coche dans
// App Store Connect. Il tient l invariant de DECLARATION cote binaire. La fiche,
// elle, se regarde chez Apple — et c est un geste d Adel.

const CHEMIN_MANIFESTE = join(__dirname, '..', 'ios', 'foundclub', 'PrivacyInfo.xcprivacy');

const FONCTIONNEMENT = 'NSPrivacyCollectedDataTypePurposeAppFunctionality';
const AUTRE = 'NSPrivacyCollectedDataTypePurposeOther';

/**
 * Les 35 valeurs valides de `NSPrivacyCollectedDataType`.
 *
 * Relevees le 2026-09-04 dans la table de conversion de l exportateur Apple de
 * Godot (`editor/export/editor_export_platform_apple_embedded.cpp`, lignes
 * 123-157), qui enumere la liste d Apple en entier. Elle sert de dictionnaire :
 * tout type declare dans le manifeste doit en faire partie.
 */
const TYPES_VALIDES_APPLE = Object.freeze([
  'NSPrivacyCollectedDataTypeAdvertisingData',
  'NSPrivacyCollectedDataTypeAudioData',
  'NSPrivacyCollectedDataTypeBrowsingHistory',
  'NSPrivacyCollectedDataTypeCoarseLocation',
  'NSPrivacyCollectedDataTypeContacts',
  'NSPrivacyCollectedDataTypeCrashData',
  'NSPrivacyCollectedDataTypeCreditInfo',
  'NSPrivacyCollectedDataTypeCustomerSupport',
  'NSPrivacyCollectedDataTypeDeviceID',
  'NSPrivacyCollectedDataTypeEmailAddress',
  'NSPrivacyCollectedDataTypeEmailsOrTextMessages',
  'NSPrivacyCollectedDataTypeEnvironmentScanning',
  'NSPrivacyCollectedDataTypeFitness',
  'NSPrivacyCollectedDataTypeGameplayContent',
  'NSPrivacyCollectedDataTypeHands',
  'NSPrivacyCollectedDataTypeHead',
  'NSPrivacyCollectedDataTypeHealth',
  'NSPrivacyCollectedDataTypeName',
  'NSPrivacyCollectedDataTypeOtherDataTypes',
  'NSPrivacyCollectedDataTypeOtherDiagnosticData',
  'NSPrivacyCollectedDataTypeOtherFinancialInfo',
  'NSPrivacyCollectedDataTypeOtherUsageData',
  'NSPrivacyCollectedDataTypeOtherUserContactInfo',
  'NSPrivacyCollectedDataTypeOtherUserContent',
  'NSPrivacyCollectedDataTypePaymentInfo',
  'NSPrivacyCollectedDataTypePerformanceData',
  'NSPrivacyCollectedDataTypePhoneNumber',
  'NSPrivacyCollectedDataTypePhotosorVideos',
  'NSPrivacyCollectedDataTypePhysicalAddress',
  'NSPrivacyCollectedDataTypePreciseLocation',
  'NSPrivacyCollectedDataTypeProductInteraction',
  'NSPrivacyCollectedDataTypePurchaseHistory',
  'NSPrivacyCollectedDataTypeSearchHistory',
  'NSPrivacyCollectedDataTypeSensitiveInfo',
  'NSPrivacyCollectedDataTypeUserID',
]);

/**
 * Ce que le binaire DOIT declarer, type par type.
 *
 * Les 15 premiers sont exactement les 15 types coches sur la fiche App Store le
 * 04/09. Le 16e, `DeviceID`, est declare parce que l app envoie et conserve le
 * jeton de notification de l appareil (`authService.js:832-839`) : c est bien un
 * identifiant de niveau appareil. ⚠️ La case « Identifiant de l appareil » reste
 * a cocher chez Apple — tant qu elle ne l est pas, l ecart existe dans l autre
 * sens, et lui seul.
 */
const TYPES_ATTENDUS = Object.freeze({
  // Note vocale : enregistrement (`voiceNoteService.js:406`) puis televersement
  // du fichier audio (`Conversation.js:4274`).
  NSPrivacyCollectedDataTypeAudioData: { finalites: [FONCTIONNEMENT], lie: true, pistage: false },
  // Zone de recherche : ville + rayon convertis en geohash de precision 3 a 6,
  // soit 156 km a 1,2 km (`MercatoFilters.js:200-204`, `placesUseCases.js:19-28`).
  NSPrivacyCollectedDataTypeCoarseLocation: {
    finalites: [FONCTIONNEMENT],
    lie: true,
    pistage: false,
  },
  // Sentry (`App.js:118`, `App.js:160`). Le rapport de plantage n est PAS
  // rattache a l identite : `Sentry.setUser` n est appele nulle part.
  NSPrivacyCollectedDataTypeCrashData: { finalites: [FONCTIONNEMENT], lie: false, pistage: false },
  // Jeton de notification (`authService.js:832-839`, POST /user-fcm-token/me/device).
  NSPrivacyCollectedDataTypeDeviceID: { finalites: [FONCTIONNEMENT], lie: true, pistage: false },
  // Champ editable du profil (`SelfProfileUnified.js:356-359`), envoye par `updateMe`.
  NSPrivacyCollectedDataTypeEmailAddress: {
    finalites: [FONCTIONNEMENT],
    lie: true,
    pistage: false,
  },
  // Minutes jouees et statistiques du match declarees par le joueur lui-meme
  // (`PlayerMatchResponseScreen.js:325`, `matchStatsService.js:103`).
  NSPrivacyCollectedDataTypeFitness: { finalites: [FONCTIONNEMENT], lie: true, pistage: false },
  // firstname / lastname (`ProfileEdit.js:255,260`).
  NSPrivacyCollectedDataTypeName: { finalites: [FONCTIONNEMENT], lie: true, pistage: false },
  // birthdate, category, height, nationality, weight (`ProfileEdit.js:253-276`).
  NSPrivacyCollectedDataTypeOtherDataTypes: {
    finalites: [FONCTIONNEMENT],
    lie: true,
    pistage: false,
  },
  // Contenu des messages (`chatService.js:259`) et historique sportif
  // (`userHistoryService.js:56`).
  NSPrivacyCollectedDataTypeOtherUserContent: {
    finalites: [FONCTIONNEMENT],
    lie: true,
    pistage: false,
  },
  // Identifiant de connexion (`authService.js:241`, `authService.js:322`).
  NSPrivacyCollectedDataTypePhoneNumber: { finalites: [FONCTIONNEMENT], lie: true, pistage: false },
  // Avatar (`ProfileEdit.js:251`) televerse par `authService.js:504`, et pieces
  // jointes des conversations (`Conversation.js:2237`).
  NSPrivacyCollectedDataTypePhotosorVideos: {
    finalites: [FONCTIONNEMENT],
    lie: true,
    pistage: false,
  },
  // Adresse postale saisie au profil (`ProfileEdit.js:250`).
  NSPrivacyCollectedDataTypePhysicalAddress: {
    finalites: [FONCTIONNEMENT],
    lie: true,
    pistage: false,
  },
  // geohash de precision 8 (~38 m x 19 m) calcule a partir de l adresse
  // (`ProfileEdit.js:233,256`) et position GPS haute precision demandee par la
  // carte de recherche (`searchMapGeolocation.js:20`).
  NSPrivacyCollectedDataTypePreciseLocation: {
    finalites: [FONCTIONNEMENT],
    lie: true,
    pistage: false,
  },
  // Achat d abonnement via RevenueCat, rattache au compte FoundClub
  // (`subscriptionRevenueCat.js:304`, `subscriptionRevenueCat.js:358`).
  NSPrivacyCollectedDataTypePurchaseHistory: {
    finalites: [AUTRE, FONCTIONNEMENT],
    lie: true,
    pistage: false,
  },
  // Alerte de recherche : les criteres et leur libelle sont conserves cote
  // serveur, rattaches au compte (`searchAlertService.js:26`).
  NSPrivacyCollectedDataTypeSearchHistory: {
    finalites: [FONCTIONNEMENT],
    lie: true,
    pistage: false,
  },
  // firebaseUid (`authService.js:376-378`).
  NSPrivacyCollectedDataTypeUserID: { finalites: [FONCTIONNEMENT], lie: true, pistage: false },
});

/**
 * Les API a raison requise que le binaire doit declarer, et leurs motifs.
 *
 * `0A2A.1` couvre le selecteur de documents : `@react-native-documents/picker`
 * n embarque AUCUN manifeste (mesure du 04/09) et lit `.fileSizeKey` sur un
 * fichier choisi par l utilisateur (`ios/swift/DocPicker.swift:39`), ce qui est
 * exactement le motif « fichier auquel l utilisateur a donne acces ».
 */
const API_ATTENDUES = Object.freeze({
  NSPrivacyAccessedAPICategoryDiskSpace: ['85F4.1'],
  NSPrivacyAccessedAPICategoryFileTimestamp: ['0A2A.1', '3B52.1', 'C617.1'],
  NSPrivacyAccessedAPICategorySystemBootTime: ['35F9.1'],
  NSPrivacyAccessedAPICategoryUserDefaults: ['1C8F.1', 'C56D.1', 'CA92.1'],
});

/**
 * Lit et analyse le manifeste. Un plist mal forme casse la compilation iOS : ici
 * il fait rougir la suite au lieu de partir en build.
 * @returns {Record<string, any>} Le contenu du manifeste.
 */
const lireLeManifeste = () => {
  const analyse = parsePlist(readFileSync(CHEMIN_MANIFESTE, 'utf8'));
  if (!analyse || typeof analyse !== 'object' || Array.isArray(analyse)) {
    throw new Error(`${CHEMIN_MANIFESTE} n est pas un dictionnaire plist`);
  }
  return /** @type {Record<string, any>} */ (analyse);
};

const MANIFESTE = lireLeManifeste();

/** @type {any[]} */
const COLLECTES = Array.isArray(MANIFESTE.NSPrivacyCollectedDataTypes)
  ? MANIFESTE.NSPrivacyCollectedDataTypes
  : [];

/** @type {any[]} */
const API_DECLAREES = Array.isArray(MANIFESTE.NSPrivacyAccessedAPITypes)
  ? MANIFESTE.NSPrivacyAccessedAPITypes
  : [];

/**
 * Retrouve l entree d un type de donnee.
 * @param {string} nom Constante Apple du type.
 * @returns {any} L entree, ou `undefined`.
 */
const entreePourType = (nom) => COLLECTES
  .find((entree) => entree?.NSPrivacyCollectedDataType === nom);

describe('PLIST — le manifeste de confidentialite est lisible', () => {
  it('est un plist valide qui porte les trois clefs attendues', () => {
    expect({
      apiTypes: Array.isArray(MANIFESTE.NSPrivacyAccessedAPITypes),
      collected: Array.isArray(MANIFESTE.NSPrivacyCollectedDataTypes),
      tracking: MANIFESTE.NSPrivacyTracking,
    }).toEqual({ apiTypes: true, collected: true, tracking: false });
  });

  // Un tableau vide declare a Apple « cette app ne collecte rien ». C est le
  // defaut que le lot L48-B avait corrige : ce temoin l empeche de revenir.
  it('declare au moins un type de donnee', () => {
    expect(COLLECTES.length).toBeGreaterThan(0);
  });
});

describe('PLIST — les types declares sont exactement ceux attendus', () => {
  // 🔴 LE TÉMOIN DU LOT : ROUGE sur les 10 types du 04/09, VERT sur les 16.
  it('la liste est exactement celle attendue, ni plus ni moins', () => {
    const declares = COLLECTES.map((entree) => entree?.NSPrivacyCollectedDataType).sort();

    expect(declares).toEqual(Object.keys(TYPES_ATTENDUS).sort());
  });

  it('aucun type n est declare deux fois', () => {
    const declares = COLLECTES.map((entree) => entree?.NSPrivacyCollectedDataType);

    expect(declares.length).toBe(new Set(declares).size);
  });

  // 🪤 Le garde-fou de la casse : une constante inventee est ignoree en silence.
  it.each(Object.keys(TYPES_ATTENDUS).sort())('%s est une constante Apple valide', (nom) => {
    expect(TYPES_VALIDES_APPLE).toContain(nom);
  });

  // Les 3 champs qu Apple exige pour CHAQUE entree, compares en bloc pour que la
  // sortie nomme le type fautif et la valeur fautive d un coup.
  it.each(Object.keys(TYPES_ATTENDUS).sort())('%s porte ses trois drapeaux', (nom) => {
    const entree = entreePourType(nom) || {};
    const attendu = TYPES_ATTENDUS[nom];

    expect({
      finalites: [...(entree.NSPrivacyCollectedDataTypePurposes || [])].sort(),
      lie: entree.NSPrivacyCollectedDataTypeLinked,
      pistage: entree.NSPrivacyCollectedDataTypeTracking,
    }).toEqual({
      finalites: [...attendu.finalites].sort(),
      lie: attendu.lie,
      pistage: attendu.pistage,
    });
  });

  // `NSPrivacyTracking` est faux plus haut : aucune entree ne peut dire l inverse.
  it('aucun type n est declare comme servant au pistage', () => {
    const pisteurs = COLLECTES
      .filter((entree) => entree?.NSPrivacyCollectedDataTypeTracking === true)
      .map((entree) => entree?.NSPrivacyCollectedDataType);

    expect(pisteurs).toEqual([]);
  });
});

describe('PLIST — les API a raison requise sont declarees', () => {
  it('les categories declarees sont exactement celles attendues', () => {
    const categories = API_DECLAREES.map((entree) => entree?.NSPrivacyAccessedAPIType).sort();

    expect(categories).toEqual(Object.keys(API_ATTENDUES).sort());
  });

  it.each(Object.keys(API_ATTENDUES).sort())('%s porte ses motifs', (categorie) => {
    const entree = API_DECLAREES
      .find((candidate) => candidate?.NSPrivacyAccessedAPIType === categorie) || {};
    const motifs = [...(entree.NSPrivacyAccessedAPITypeReasons || [])].sort();

    expect(motifs).toEqual([...API_ATTENDUES[categorie]].sort());
  });
});
