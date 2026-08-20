import {
  buildProfileSaveConfirmation,
  listChangedProfileFields,
} from '../profileSaveConfirmation';

// AA11 — TEMOIN 1 et TEMOIN 6.
//
// Constat d'Adel du 2026-08-20 : « quand on modifie une information du profil,
// on manque d'un pop-up pour dire "felicitations, votre (info) a ete
// modifiee" ». Le mot qui porte tout est « (info) » : une phrase creuse
// (« Succes », « OK ») ne dit pas CE QUI a change, et c'est justement la seule
// chose qu'on veuille savoir apres avoir touche a un formulaire de 16 champs.
//
// Ce fichier fige donc deux choses :
//   1. la confirmation NOMME le champ modifie ;
//   2. quand RIEN n'a change, il n'y a rien a annoncer.
//
// ⚠️ Ce module ne sait pas si l'enregistrement a reussi. Il ne fabrique qu'une
// phrase — le garde-fou « aucune confirmation sur un echec » est tenu par
// l'appelant, et il est fige par `ProfileEdit.confirmation.test.js`.

const traductions = jest.requireActual('@/theme/strings/translations/fr').default;

/**
 * La traduction reelle, lue dans `fr.js` : le test echoue donc aussi si une
 * clef manque a l'appel.
 * @param {string} cle
 * @param {any} [repli]
 * @returns {string}
 */
const t = (cle, repli) => {
  const valeur = String(cle || '').split('.').reduce(
    (/** @type {any} */ noeud, /** @type {string} */ segment) => (
      noeud && typeof noeud === 'object' ? noeud[segment] : undefined
    ),
    traductions,
  );
  if (typeof valeur === 'string') return valeur;
  return typeof repli === 'string' ? repli : cle;
};

/** Un profil deja rempli, dans la forme que le formulaire manipule. */
const profilAvant = {
  address: { label: 'Marseille', value: '5.37|43.29' },
  avatar: { url: '/uploads/luc.jpg' },
  bestLevel: 'Départemental',
  birthdate: '15/01/2000',
  category: 'Senior',
  firstname: 'Luc',
  height: '1.80',
  isLookingForClub: true,
  jerseyNumber: '10',
  lastname: 'Harne',
  nationality: 'Française',
  phoneNumber: '+33612345678',
  position: 'Ailier',
  preferredSport: 'football',
  section: 'sec-1',
  weight: '75',
};

describe('AA11 — ce qui a change se NOMME', () => {
  it('ne retient que les champs reellement modifies', () => {
    const changes = listChangedProfileFields(profilAvant, {
      ...profilAvant,
      phoneNumber: '+33699999999',
    });

    expect(changes).toEqual(['phoneNumber']);
  });

  it('nomme le champ dans la phrase, avec son libelle d\'ecran', () => {
    const confirmation = buildProfileSaveConfirmation(['phoneNumber'], t);

    expect(confirmation).not.toBeNull();
    expect(confirmation?.body).toContain('Numéro de téléphone');
    // ⛔ Le « OK » creux que le lot interdit.
    expect(confirmation?.body).not.toBe('OK');
    expect(confirmation?.title).not.toBe('Succès');
  });

  it('nomme les DEUX champs quand deux ont change', () => {
    const changes = listChangedProfileFields(profilAvant, {
      ...profilAvant,
      avatar: { url: '/uploads/luc-2.jpg' },
      lastname: 'Harnois',
    });
    const confirmation = buildProfileSaveConfirmation(changes, t);

    expect(changes.sort()).toEqual(['avatar', 'lastname']);
    expect(confirmation?.body).toContain('Nom');
    expect(confirmation?.body).toContain('Photo de profil');
  });

  it('compte au lieu d\'enumerer au-dela de deux champs', () => {
    const changes = listChangedProfileFields(profilAvant, {
      ...profilAvant,
      height: '1.85',
      position: 'Attaquant',
      weight: '78',
    });
    const confirmation = buildProfileSaveConfirmation(changes, t);

    expect(changes).toHaveLength(3);
    expect(confirmation?.body).toContain('3');
  });

  it('ne fabrique AUCUNE phrase quand rien n\'a change', () => {
    const changes = listChangedProfileFields(profilAvant, { ...profilAvant });

    expect(changes).toEqual([]);
    expect(buildProfileSaveConfirmation(changes, t)).toBeNull();
  });

  it('ne confond pas 75 et « 75 », ni une adresse identique recopiee', () => {
    const changes = listChangedProfileFields(profilAvant, {
      ...profilAvant,
      address: { label: 'Marseille', value: '5.37|43.29' },
      weight: 75,
    });

    expect(changes).toEqual([]);
  });

  // 🔒 TEMOIN 6 — AUCUNE CLEF DE TRADUCTION PERDUE, version executable.
  //
  // ⚠️ Le controle « aucune suppression dans `fr.js` » compte des LIGNES, pas
  // des CLEFS : un simple changement de valeur y apparait comme une
  // suppression suivie d'un ajout. La comparaison des ENSEMBLES de clefs a bien
  // ete faite a la main pour ce lot (2 224 -> 2 243, zero disparue), mais elle
  // ne survit pas au lot suivant. Ce test-ci, si : il echoue le jour ou l'une
  // des clefs que la confirmation NOMME disparait de `fr.js`.
  it('chaque champ nomme resout une VRAIE clef de `fr.js`', () => {
    const tousLesChamps = [
      'address', 'avatar', 'bestLevel', 'birthdate', 'category', 'email',
      'firstname', 'height', 'isLookingForClub', 'jerseyNumber', 'lastname',
      'nationality', 'phoneNumber', 'position', 'preferredSport', 'section',
      'sportsHistory', 'weight',
    ];

    tousLesChamps.forEach((champ) => {
      const confirmation = buildProfileSaveConfirmation([champ], t);
      expect(confirmation).not.toBeNull();
      // `t` ci-dessus rend le CHEMIN de la clef quand elle manque : voir un
      // « profile.fields… » dans la phrase, c'est une clef disparue.
      expect(confirmation?.body).not.toContain('profile.fields');
      expect(confirmation?.body).not.toContain('{{');
    });
  });

  it('les trois tournures resolvent aussi, une / deux / plusieurs', () => {
    expect(buildProfileSaveConfirmation(['lastname'], t)?.body)
      .not.toContain('profile.saveConfirmation');
    expect(buildProfileSaveConfirmation(['lastname', 'firstname'], t)?.body)
      .not.toContain('profile.saveConfirmation');
    expect(buildProfileSaveConfirmation(['lastname', 'firstname', 'weight'], t)?.body)
      .not.toContain('profile.saveConfirmation');
    expect(buildProfileSaveConfirmation(['lastname'], t)?.title)
      .not.toContain('profile.saveConfirmation');
  });

  it('chaque libelle vient de `fr.js`, aucun texte en dur', () => {
    const changes = listChangedProfileFields(profilAvant, {
      ...profilAvant,
      birthdate: '16/01/2000',
    });
    // Le repli `cle` de `t` ci-dessus : si la clef n'existait pas dans `fr.js`,
    // la phrase porterait le chemin de la clef au lieu du libelle.
    const confirmation = buildProfileSaveConfirmation(changes, t);

    expect(confirmation?.body).toContain('Date de naissance');
    expect(confirmation?.body).not.toContain('profile.fields');
    expect(confirmation?.title).not.toContain('profile.');
  });
});
