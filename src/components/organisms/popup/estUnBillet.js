/**
 * IMPL-4-ACCUEIL, page 5 (variante B « billet », Adel 18/11) — LE seul prédicat du billet : le
 * modèle `hero_image_modal` ET une action principale qui ouvre un événement. Pas de clé neuve : le
 * serveur ramène toute clé inconnue à `standard_modal` (enum du schéma, CAMPAIGN_TEMPLATES).
 * ponytail: une campagne déjà enregistrée en hero_image_modal + open_event prend le billet ; si
 * l'événement ne se lit pas, la fenêtre d'avant. Sortie : un modèle `ticket_modal` côté admin.
 * @param {any} campaign - La campagne.
 * @param {any} primaryAction - Son action principale.
 * @returns {boolean} Le billet, ou la fenêtre d'avant.
 */
const estUnBillet = (campaign, primaryAction) => campaign?.templateKey === 'hero_image_modal'
  && primaryAction?.actionType === 'open_event'
  && Boolean(String(primaryAction?.eventId || '').trim());

export default estUnBillet;
