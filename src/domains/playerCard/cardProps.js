// @ts-nocheck
/**
 * CARTECODE (planche v2, direction C) — du modèle de la carte (buildPlayerCardModel) aux props
 * du dessin (PlayerCard). Partagé par « Ma carte joueur » et la vignette du profil d'un autre
 * (Q2 B). Une valeur vide reste vide : à l'écran elle devient « + à compléter », dans l'image
 * partagée elle disparaît. Rien n'est inventé.
 */
import { formatHeight } from '@/utils/heightCentimeters';

/** Raretés du modèle -> raretés du dessin (4, sans or). */
const CARD_RARITY = {
  common: 'COMMON',
  epic: 'EPIC',
  legendary: 'LEGENDARY',
  rare: 'RARE',
};

/**
 * Période d'un club de l'historique : « 2023–AUJ. », « 2019–2023 ».
 * @param {object} entry
 * @param {string} nowLabel
 * @returns {string}
 */
const formatHistoryPeriod = (entry, nowLabel) => {
  const end = entry.isCurrentlyActive ? nowLabel : entry.endYear || '';
  return [entry.startYear, end].filter(Boolean).join('–');
};

/**
 * Les props du dessin, tirées du modèle de la carte.
 * @param {object} params
 * @param {object} params.model modèle de la carte
 * @param {{ personal?: boolean }} [params.qr] cible du code QR
 * @param {{
 *   now?: string, qrNeutral?: string, qrProfile?: string, yearsUnit?: string,
 * }} [params.labels]
 * @param {(url: string) => string} [params.imageUrl] résout une URL d'image du serveur
 * @param {boolean} [params.locked]
 * @returns {object} les props de PlayerCard
 */
export const buildPlayerCardProps = ({
  imageUrl = (url) => url,
  labels = {},
  locked = false,
  model,
  qr = {},
}) => ({
  age: model.age != null ? `${model.age} ${labels.yearsUnit || 'ans'}` : '',
  categorie: model.category || '',
  club: model.club?.name || '',
  clubLogoUrl: model.club?.logoUrl ? imageUrl(model.club.logoUrl) : null,
  equipe: model.club?.teamName || '',
  // Q4 A : 3 logos et leurs années (le détail reste dans le profil).
  historique: (model.historyGroups || []).slice(0, 3).map((entry) => ({
    club: entry.clubName,
    logoUrl: entry.clubLogoUrl ? imageUrl(entry.clubLogoUrl) : null,
    periode: formatHistoryPeriod(entry, labels.now || 'AUJ.'),
  })),
  locked,
  nationalite: model.nationality || '',
  niveau: model.level || '',
  nom: model.lastname || '',
  numero: model.number === null || model.number === undefined ? '' : String(model.number),
  photo: model.photoUrl ? { uri: imageUrl(model.photoUrl) } : undefined,
  poids: model.weight ? `${model.weight} kg` : '',
  poste: model.position || '',
  prenom: model.firstname || '',
  qrLabel: qr.personal ? labels.qrProfile || 'mon profil' : labels.qrNeutral || 'foundclub.app',
  qrValue: model.qrUrl || '',
  rarity: CARD_RARITY[model.rarity] || 'COMMON',
  section: model.section || '',
  sport: model.sport || '',
  statut: model.isAvailable ? 'DISPONIBLE' : 'INDISPONIBLE',
  taille: model.height ? formatHeight(model.height) : '',
  ville: model.city || '',
});

export default buildPlayerCardProps;
