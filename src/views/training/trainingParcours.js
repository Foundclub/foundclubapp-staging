import { mesuresParFamille } from '@/views/training/trainingTestModel';

/**
 * LE PARCOURS GUIDÉ D'UN TEST — la file d'arrêts qu'on suit sur le terrain.
 *
 * 🔎 POURQUOI UNE FILE ET PAS UNE PAGE. Un test se fait en marchant : on installe, on
 * s'échauffe, on fait un essai, on souffle, on refait un essai, on souffle, et on
 * valide à la fin. La page unique demandait de tenir tout ça de tête et de retrouver
 * la bonne case à chaque fois. La file, elle, ne montre QUE ce qu'on fait maintenant
 * et dit toujours ce qui vient après.
 *
 * 🪤 LA RÉCUPÉRATION EST UN ARRÊT, PAS UN ÉTAT. C'est la décision qui structure tout :
 * après chaque essai, on ne revient pas à la liste — on tombe sur une page pleine où
 * le compte à rebours tourne DÉJÀ. Sans elle, la récupération est un chiffre qu'on
 * oublie de lancer, et le protocole se perd essai après essai sans que rien ne le dise.
 *
 * ⚠️ L'ÉCHAUFFEMENT VIENT DE LA JOURNÉE, PAS DU TEST. Aucun test du programme ne porte
 * de champ d'échauffement — 17 des 33 n'en ont aucun nulle part. La journée, elle, en
 * porte un pour les huit. On montre donc celui de la journée : c'est la seule source
 * qui existe, et elle est toujours là.
 */

/** Les types d'arrêt, dans l'ordre où on les traverse. */
export const ARRETS = {
  ATTEMPT: 'attempt',
  END: 'end',
  PREP: 'prep',
  RECOVERY: 'recovery',
  WARMUP: 'warmup',
};

/** Sans durée prescrite, on souffle deux minutes : le défaut assumé de l'app. */
export const RECUP_PAR_DEFAUT = 120;

/**
 * LA FILE D'ARRÊTS D'UN TEST, dans l'ordre.
 * @param {Record<string, any>} test le test du programme
 * @returns {Record<string, any>[]} les arrêts, chacun avec sa clef et son libellé court
 */
export const arretsDuTest = (test) => {
  const familles = mesuresParFamille(test);
  const essais = Math.max(1, ...familles.parEssai.map((m) => Number(m.attempts) || 1));

  /** @type {Record<string, any>[]} */
  const file = [
    { cle: 'prep', court: 'Prépa', type: ARRETS.PREP },
    { cle: 'warmup', court: 'Éch.', type: ARRETS.WARMUP },
  ];

  for (let essai = 1; essai <= essais; essai += 1) {
    file.push({
      cle: `attempt-${essai}`, court: String(essai), essai, total: essais, type: ARRETS.ATTEMPT,
    });
    // ⛔ PAS DE RÉCUPÉRATION APRÈS LE DERNIER ESSAI : elle n'a rien à annoncer,
    // et elle retarderait la validation d'un écran pour rien.
    if (essai < essais) {
      file.push({
        cle: `recovery-${essai}`,
        court: '·',
        essai,
        total: essais,
        type: ARRETS.RECOVERY,
      });
    }
  }

  file.push({ cle: 'end', court: 'Fin', type: ARRETS.END });
  return file;
};

/**
 * L'arrêt demandé, et ses voisins.
 * @param {Record<string, any>[]} file les arrêts du test
 * @param {string} cle la clef de l'arrêt courant
 * @returns {{courant: Record<string, any>|null, index: number,
 *   suivant: Record<string, any>|null}} l'arrêt et ce qui le suit
 */
export const situer = (file, cle) => {
  /** @type {Record<string, any>[]} */
  const arrets = Array.isArray(file) ? file : [];
  const index = Math.max(0, arrets.findIndex((a) => a.cle === cle));
  return {
    courant: arrets[index] || null,
    index,
    suivant: arrets[index + 1] || null,
  };
};

/**
 * L'ÉTAT DE CHAQUE ARRÊT, pour le ruban : fait, en cours, à venir.
 *
 * 🪤 UN ARRÊT EST « FAIT » QUAND ON L'A DÉPASSÉ, pas quand il a produit une donnée.
 * La mise en place et l'échauffement ne produisent rien : les mesurer à la donnée les
 * laisserait gris pour toujours, et le ruban dirait qu'on n'a rien fait alors qu'on
 * vient d'installer le matériel pendant cinq minutes.
 * @param {Record<string, any>[]} file les arrêts du test
 * @param {string} cle la clef de l'arrêt courant
 * @returns {('done'|'current'|'todo')[]} un état par arrêt, dans l'ordre
 */
export const etatsDuRuban = (file, cle) => {
  const { index } = situer(file, cle);
  return (Array.isArray(file) ? file : []).map((_, rang) => {
    if (rang < index) return 'done';
    return rang === index ? 'current' : 'todo';
  });
};

/**
 * Les lignes de mise en place, à cocher une par une.
 *
 * 🔎 ELLES EXISTENT DÉJÀ EN TEXTE pour 31 des 33 tests : ce sont les listes à puces de
 * la rubrique « La mise en place ». On ne les réécrit pas, on les rend cochables — un
 * texte qu'on relit en installant ne dit jamais où on en est.
 * @param {Record<string, any>} test le test du programme
 * @returns {string[]} une ligne par point de mise en place
 */
export const lignesDeMiseEnPlace = (test) => {
  /** @type {Record<string, any>[]} */
  const blocs = Array.isArray(test?.setup) ? test.setup : [];
  return blocs
    .filter((bloc) => bloc?.type === 'ul' || bloc?.type === 'ol')
    .flatMap((bloc) => (Array.isArray(bloc.items) ? bloc.items : []))
    .map((item) => String(typeof item === 'string' ? item : item?.text || ''))
    .filter(Boolean);
};

/**
 * LES TROIS PREMIÈRES CONSIGNES DU GESTE, et pas une de plus.
 *
 * 🔎 POURQUOI TROIS. Entre deux essais, on relit une consigne en dix secondes, debout,
 * en soufflant. Le protocole complet fait souvent quinze lignes : le montrer là revient
 * à ne rien montrer, parce qu'on ne le lit pas. Trois lignes se lisent. Le reste
 * n'est pas perdu — il vit dans « Comprendre », à un bouton de distance.
 * @param {Record<string, any>} test le test du programme
 * @returns {string[]} au plus trois consignes
 */
export const gesteEnTroisLignes = (test) => {
  /** @type {Record<string, any>[]} */
  const blocs = Array.isArray(test?.protocol) ? test.protocol : [];
  return blocs
    .filter((bloc) => bloc?.type === 'ul' || bloc?.type === 'ol')
    .flatMap((bloc) => (Array.isArray(bloc.items) ? bloc.items : []))
    .map((item) => String(typeof item === 'string' ? item : item?.text || ''))
    .filter(Boolean)
    .slice(0, 3);
};

/**
 * LA DURÉE DE L'ÉCHAUFFEMENT, en minutes.
 *
 * 🪤 ELLE N'A PAS DE CHAMP, mais elle est écrite : le tableau du déroulé de chaque
 * journée porte une ligne « RAMP (échauffement en 4 phases) · 18 min ». On la lit là où
 * elle est plutôt que de demander une colonne de plus au serveur — et le jour où le
 * programme change son échauffement, le chiffre suit tout seul.
 * @param {Record<string, any>} day la journée du programme
 * @returns {number|null} la durée en minutes, ou `null` si le déroulé n'en dit rien
 */
export const dureeEchauffement = (day) => {
  /** @type {Record<string, any>[]} */
  const blocs = Array.isArray(day?.timeline) ? day.timeline : [];
  /** @type {number|null} */
  let minutes = null;

  blocs.filter((bloc) => bloc?.type === 'table').forEach((bloc) => {
    // La colonne se cherche par son NOM : les journées n'ont pas toutes le même
    // nombre de colonnes, et un rang en dur casserait au premier tableau court.
    const entetes = (bloc.head || []).map((h) => String(h).toLowerCase());
    const colonne = entetes.findIndex((h) => h.includes('dur'));
    if (colonne < 0) return;

    (Array.isArray(bloc.rows) ? bloc.rows : []).forEach((ligne) => {
      if (minutes !== null) return;
      const libelle = String(ligne[1] || '').replace(/\*/g, '');
      if (!/ramp|chauff/i.test(libelle)) return;
      const trouve = /(\d+)\s*min/i.exec(String(ligne[colonne] || '').replace(/\*/g, ''));
      if (trouve) minutes = Number(trouve[1]);
    });
  });

  return minutes;
};

/**
 * COMBIEN DE MESURES DE CE TEST ATTENDENT LA VIDÉO.
 * @param {Record<string, any>} test le test du programme
 * @returns {number} le nombre de valeurs à lire plus tard, tous essais confondus
 */
export const mesuresQuiAttendentLaVideo = (test) => {
  /** @type {Record<string, any>[]} */
  const mesures = Array.isArray(test?.measures) ? test.measures : [];
  return mesures
    .filter((m) => m?.moment !== 'terrain')
    .reduce((total, m) => total + Math.max(1, Number(m.attempts) || 1), 0);
};

export default arretsDuTest;
