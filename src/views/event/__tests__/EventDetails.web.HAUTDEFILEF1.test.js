import fs from 'fs';
import path from 'path';

// HAUT-DEFILE-F1 (12/11/2026, décision d'Adel « 245 B » : « le haut défile ») — la fiche d'un
// Événement sur le SITE (EventDetails.web.js). Témoin CARACTÉRISANT (vert avant le lot, E6) : la
// page du site défile d'un bloc (une grille unique dans le cadre), sans liste bornée sous un haut
// figé ; le bandeau « Événement annulé » et l'encart « Événement créé » sont dans cette grille.
// Le téléphone (EventDetails.js) est corrigé par ce lot : témoin dans EventDetailsP7Detection.

const SOURCE = fs.readFileSync(path.resolve(__dirname, '..', 'EventDetails.web.js'), 'utf8');

describe('HAUT-DEFILE-F1 — fiche Événement du site : la page défile d un bloc', () => {
  const rendu = SOURCE.slice(SOURCE.lastIndexOf('<ScreenContainer'));

  it('le cadre ne borne pas la hauteur et ne contient aucune liste qui défile seule', () => {
    const ouverture = rendu.slice(0, rendu.indexOf('>'));
    expect(ouverture).not.toContain('boundedHeight');
    expect(rendu).not.toContain('<ScrollView');
    expect(rendu).not.toContain('<FlatList');
  });

  it('le premier enfant du cadre est la grille qui porte tout, bandeaux du haut compris', () => {
    const apres = rendu.slice(rendu.indexOf('>') + 1).trimStart();
    expect(apres.startsWith("<div style={{ color: textColor, display: 'grid', gap: 24 }}>")).toBe(true);
    const grille = apres.slice(0, apres.indexOf('data-testid="event-cancelled-banner"'));
    expect(grille).toContain('fromEventCreation');
  });
});
