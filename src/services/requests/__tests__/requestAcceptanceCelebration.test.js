import { buildRequestAcceptanceCelebration } from '../requestAcceptanceCelebration';

/**
 * Y04 — LA TABLE DES HUIT PHRASES DE FELICITATIONS.
 *
 * Demande d Adel (2026-08-19) : « un pop-up "felicitations, demande acceptee"
 * ADAPTE EN FONCTION DE LA DEMANDE ». Ce filet verifie que les huit types ont
 * chacun leur phrase, et surtout qu AUCUN ne retombe sur le texte generique —
 * c est exactement ce que « adapte » veut dire.
 *
 * ⚠️ `t` est ici le vrai contrat de l app : `(clef, repli) => repli`. Ce sont
 * donc les REPLIS qu on lit, et c est voulu — verifier la clef ET la phrase
 * dans le meme temoin attrape la faute de frappe des deux cotes.
 */

/**
 * La traduction telle que l ecran la recoit : la clef d abord, le repli ensuite.
 * @param {string} key La clef demandee.
 * @param {string} [fallback] Le texte de repli.
 * @returns {string} Le repli, ou la clef s il n y en a pas.
 */
const t = (key, fallback) => fallback || key;

const item = (type, requesterName = '') => ({
  id: `${type}:1`,
  meta: requesterName ? { requesterName } : {},
  type,
});

describe('Y04 — les huit phrases de felicitations', () => {
  it('temoin 4 — une adhesion d equipe nomme L EQUIPE, pas « la demande »', () => {
    const { message, title } = buildRequestAcceptanceCelebration(item('team', 'Zinedine'), t);

    expect(title).toBe('Félicitations');
    expect(message).toBe("Zinedine rejoint l'équipe.");
    // 🔑 Le contre-controle qui donne sa valeur au temoin : surtout PAS le
    // texte generique.
    expect(message).not.toBe('La demande est acceptée.');
  });

  it('temoin 5 — un match amical affiche la fenetre DU MATCH', () => {
    const { message } = buildRequestAcceptanceCelebration(item('friendly'), t);

    expect(message).toBe('Le match est confirmé.');
    expect(message).not.toBe('La demande est acceptée.');
  });

  it('les huit types ont chacun leur phrase, et aucune n est partagee', () => {
    const phrases = [
      ['team', "Zinedine rejoint l'équipe."],
      ['club', 'Zinedine rejoint le club.'],
      ['event', 'La participation est validée.'],
      ['featured', "L'événement passe à la une."],
      ['installation', 'La place supplémentaire est accordée.'],
      ['interest', 'Ta réponse est partie.'],
      ['friendly', 'Le match est confirmé.'],
      ['unknown', 'La demande est acceptée.'],
    ];

    phrases.forEach(([type, expected]) => {
      expect(buildRequestAcceptanceCelebration(item(type, 'Zinedine'), t).message).toBe(expected);
    });

    expect(new Set(phrases.map(([, phrase]) => phrase)).size).toBe(8);
  });

  it('un type inconnu retombe sur la phrase generique, il ne casse pas', () => {
    expect(buildRequestAcceptanceCelebration(item('type-de-demain'), t).message)
      .toBe('La demande est acceptée.');
    expect(buildRequestAcceptanceCelebration(null, t).message)
      .toBe('La demande est acceptée.');
  });

  it('sans nom, la phrase reste lisible — jamais « rejoint l equipe » tout court', () => {
    const { message } = buildRequestAcceptanceCelebration(item('team'), t);

    expect(message).toBe("Un nouveau membre rejoint l'équipe.");
    expect(message).not.toContain('{{name}}');
  });
});

// 👶 PARENT-FINITIONS 5 (14/10) — ACCEPTER LA PLACE D'UN ENFANT le fait ENTRER dans l'equipe :
// la fenetre le dit. Avant : « Ta réponse est partie. », la phrase de l'interet d'un ADULTE.
describe('PARENT-FINITIONS 5 — la place d un enfant acceptee', () => {
  const placeEnfant = (meta) => ({
    id: 'interest:place-anissa',
    meta: {
      childFirstname: 'Anissa',
      childId: 'enfant-anissa',
      clubName: 'FoundClub',
      requesterName: 'Maryline Monroe',
      teamName: 'U11 Filles',
      ...meta,
    },
    type: 'interest',
  });

  it('« Anissa rejoint U11 Filles. », jamais « Ta réponse est partie. »', () => {
    const { message, title } = buildRequestAcceptanceCelebration(placeEnfant({}), t);

    expect(title).toBe('Félicitations');
    expect(message).toBe('Anissa rejoint U11 Filles.');
    expect(message).not.toContain('Maryline');
  });

  it('une place demandee au club sans equipe nommee : le club', () => {
    const { message } = buildRequestAcceptanceCelebration(placeEnfant({ teamName: '' }), t);

    expect(message).toBe('Anissa rejoint FoundClub.');
  });

  it('l interet d un ADULTE garde sa phrase', () => {
    const { message } = buildRequestAcceptanceCelebration(item('interest', 'Maryline'), t);

    expect(message).toBe('Ta réponse est partie.');
  });
});
