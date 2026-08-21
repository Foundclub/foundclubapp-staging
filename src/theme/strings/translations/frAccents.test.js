import fr from '@/theme/strings/translations/fr';

// AC11 — filet posé AVANT la correction en masse des accents de `fr.js`.
// Il garde trois choses à la fois : que les valeurs corrigées portent bien leurs
// accents, qu'AUCUNE clef n'a été renommée ou perdue au passage, et qu'aucun
// outil d'écriture n'a mangé les accents du fichier entier.

const read = (path) => path.split('.').reduce((node, part) => (node == null ? node : node[part]), fr);

const leaves = (node, prefix = []) =>
  Object.entries(node).flatMap(([key, value]) =>
    value !== null && typeof value === 'object'
      ? leaves(value, prefix.concat(key))
      : [[prefix.concat(key).join('.'), value]],
  );

// Les 20 valeurs auxquelles ce lot ajoute un accent, chemin de clef inchangé.
const CORRIGEES = [
  ['conversation.attachments.camera', 'Caméra'],
  ['eventWizard.steps.participants.previewTitle', 'Aperçu'],
  ['eventWizard.steps.validation.autoRuleOne', 'Check-in simplifié pour les joueurs'],
  ['eventWizard.steps.validation.autoRuleTwo', 'Idéal pour les sessions ouvertes'],
  ['eventWizard.steps.validation.previewTitle', 'Mode sélectionné'],
  ['facilityList.badges.shared', 'Partagée'],
  ['facilityList.planning.scopeShared', 'Partagées'],
  ['homeHubTutorial.steps.profileAlerts.description', 'Configure des alertes personnalisées selon tes recherches.'],
  ['multisport.accessibility.openSectionHint', 'Ouvrir le détail de la section'],
  ['notifications.labels.participationDeclined', 'Refusée'],
  ['squadDetails.slots.multipleAdded', '{{count}} créneaux ajoutés'],
  ['superAdminContentManager.actions.refresh', 'Rafraîchir'],
  ['superAdminContentManager.alerts.openCameraFailed', "Impossible d'ouvrir la caméra."],
  ['superAdminContentManager.detail.noRelations', 'Aucune relation ou média exploitable.'],
  ['superAdminContentManager.media.camera', 'Caméra'],
  ['teamSlotList.cta.confirmPresence', 'Je suis présent'],
  ['userDetails.empty.club', 'Aucun club renseigné'],
  ['userDetails.fields.age', 'Âge'],
];

// Mots qui s'écrivent SANS accent : y en ajouter un serait le défaut inverse.
const SANS_ACCENT = ['match', 'club', 'sport', 'score', 'squad', 'staff', 'supprimer', 'rejoindre', 'participer', 'requis'];

describe('AC11 — les accents de fr.js', () => {
  it('charge toujours le fichier de traductions', () => {
    expect(typeof fr).toBe('object');
    expect(fr).not.toBeNull();
    expect(leaves(fr).length).toBeGreaterThanOrEqual(1462);
  });

  it('ne renomme ni ne supprime aucune des clefs corrigées', () => {
    const perdues = CORRIGEES.filter(([path]) => typeof read(path) !== 'string').map(([path]) => path);
    expect(perdues).toEqual([]);
  });

  it.each(CORRIGEES)('%s porte son accent', (path, attendu) => {
    expect(read(path)).toBe(attendu);
  });

  it("laisse la longue phrase de suppression d'équipe entièrement accentuée", () => {
    const phrase = read('squadDetails.delete.confirmationWithName');
    expect(phrase).toContain('Es-tu sûr');
    expect(phrase).toContain('irréversible');
  });

  it("retire l'accent posé sur le verbe du mode de validation manuel", () => {
    // « Le coach validé manuellement » : accent EN TROP, c'est le présent du verbe.
    expect(read('eventWizard.steps.validation.manualDesc')).toBe(
      'Le coach valide manuellement les participants.',
    );
  });

  it("n'ajoute pas d'accent aux mots qui n'en portent pas", () => {
    const textes = leaves(fr)
      .map(([, value]) => value)
      .filter((value) => typeof value === 'string')
      .join(' ')
      .toLowerCase();
    const fautifs = SANS_ACCENT.filter((mot) => {
      const accentue = mot.replace(/a/g, 'à').replace(/e/g, 'é').replace(/o/g, 'ô').replace(/u/g, 'û');
      return textes.includes(accentue);
    });
    expect(fautifs).toEqual([]);
  });

  it("ne laisse aucun accent mangé par un outil d'écriture", () => {
    const abimees = leaves(fr)
      .filter(([, value]) => typeof value === 'string' && /[\u00C3\u00C2][\u0080-\u00BF]|\uFFFD/.test(value))
      .map(([path]) => path);
    expect(abimees).toEqual([]);
  });
});
