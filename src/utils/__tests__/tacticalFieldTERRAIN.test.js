import { getTacticalFieldFamilyKey, getTacticalSportKey } from '../tacticalField';

// 🚨 LOT TERRAIN — CHANTIER A : « TROIS SPORTS RECOIVENT UN TERRAIN FAUX ».
//
// Mesure du 2026-09-05 sur la base de PRODUCTION : 2 148 clubs voient
// aujourd'hui un terrain qui ment, parce que l'aiguillage devine avec un
// `includes()` au lieu de nommer.
//   · Futsal (1 712 clubs)              -> recevait les 11 postes du football
//   · Football americain / Flag (281)   -> recevait « Gardien », « Ailier »...
//   · Rugby a XIII (155)                -> recevait les 15 postes du XV
//
// ⚠️ CE QUE CE FICHIER FIGE EN PLUS, et qui n'etait pas dans la demande : la
// cle de sport ne sert pas qu'aux postes, elle sert aussi a DESSINER le
// terrain (`RenderedTacticalField`, `switch` sur la cle) et a le COLORER
// (`SPORT_PALETTES`). Un futsal qui deviendrait une cle inconnue recevrait un
// terrain gris. D'ou la 2e fonction : `getTacticalFieldFamilyKey`, qui rend la
// famille de DESSIN — foot pour le futsal, rugby pour le XIII.

describe('TERRAIN T1 — les 3 sports qui recevaient un terrain faux', () => {
  test('le futsal n est plus du football : il a sa propre cle', () => {
    expect(getTacticalSportKey('Futsal')).toBe('futsal');
    expect(getTacticalSportKey('futsal')).toBe('futsal');
    // Le libelle tel qu'il circule dans les activites du produit.
    expect(getTacticalSportKey('Football en salle / Futsal')).toBe('futsal');
  });

  test('le football americain et le flag ne recoivent PLUS les postes du foot', () => {
    expect(getTacticalSportKey('Football américain')).not.toBe('football');
    expect(getTacticalSportKey('Football americain')).not.toBe('football');
    expect(getTacticalSportKey('Flag Football')).not.toBe('football');
    expect(getTacticalSportKey('Foot US')).not.toBe('football');
  });

  test('le rugby a XIII n est plus le rugby a XV', () => {
    expect(getTacticalSportKey('Rugby à XIII')).toBe('rugby13');
    expect(getTacticalSportKey('Rugby a 13')).toBe('rugby13');
    expect(getTacticalSportKey('Rugby League')).toBe('rugby13');
  });

  test('l ORDRE des regles est bon : le futsal n est pas rattrape par « foot »', () => {
    // « futsal » ne contient pas « foot », mais « Football en salle » si.
    // Et « Football américain » contient « foot » : c'est l'ordre des regles
    // qui decide, jamais la chance.
    expect(getTacticalSportKey('Football en salle')).toBe('futsal');
    expect(getTacticalSportKey('Rugby à XIII')).not.toBe('rugby');
  });
});

describe('TERRAIN T2 — anti-regression : ce qui marchait continue', () => {
  test.each([
    ['Football', 'football'],
    ['football', 'football'],
    ['Soccer', 'football'],
    ['Basketball', 'basketball'],
    ['Basket', 'basketball'],
    ['Handball', 'handball'],
    ['Volley', 'volleyball'],
    ['Volleyball', 'volleyball'],
    ['Rugby', 'rugby'],
    ['Rugby à XV', 'rugby'],
    ['Rugby a 15', 'rugby'],
  ])('« %s » aiguille toujours vers « %s »', (libelle, attendu) => {
    expect(getTacticalSportKey(libelle)).toBe(attendu);
  });

  test('un sport inconnu et un sport vide restent generiques', () => {
    expect(getTacticalSportKey('Judo')).toBe('generic');
    expect(getTacticalSportKey('Danse')).toBe('generic');
    expect(getTacticalSportKey('')).toBe('generic');
    expect(getTacticalSportKey(null)).toBe('generic');
    expect(getTacticalSportKey(undefined)).toBe('generic');
  });

  // 📌 Les 2 doublons de donnees SIGNALES au chef d'orchestre (Volley 2 274
  // clubs / Volleyball 748 ; « Roller et Rink Hockey » 304 / « Roller & Rink
  // Hockey » 177). On ne fusionne PAS la donnee — c'est une decision d'Adel —
  // mais l'aiguillage doit deja les traiter pareil, et ce temoin le prouve.
  test('les doublons de donnees aiguillent de facon IDENTIQUE', () => {
    expect(getTacticalSportKey('Volley')).toBe(getTacticalSportKey('Volleyball'));
    expect(getTacticalSportKey('Roller et Rink Hockey'))
      .toBe(getTacticalSportKey('Roller & Rink Hockey'));
  });
});

describe('TERRAIN — la famille de DESSIN reste peinte, jamais grise', () => {
  test('le futsal se dessine comme un terrain de foot, le XIII comme un rugby', () => {
    expect(getTacticalFieldFamilyKey('Futsal')).toBe('football');
    expect(getTacticalFieldFamilyKey('Rugby à XIII')).toBe('rugby');
  });

  test('pour tous les autres, la famille EST la cle de sport', () => {
    ['Football', 'Basketball', 'Handball', 'Volleyball', 'Rugby', 'Judo']
      .forEach((libelle) => {
        expect(getTacticalFieldFamilyKey(libelle)).toBe(getTacticalSportKey(libelle));
      });
  });
});
