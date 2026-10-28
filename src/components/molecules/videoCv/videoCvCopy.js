import i18next from 'i18next';

// VIDEOCV — les textes de la vidéo du profil : la clé vit dans fr.js / en.js (bloc `videoCv`),
// le repli ci-dessous en est la copie française, mot pour mot (planche M1 à M9).
const REPLIS = {
  cardTitle: 'Vidéo',
  'errors.embed.body': 'Son auteur ne permet pas de la lire dans une autre application.',
  'errors.embed.title': 'Cette vidéo se regarde sur YouTube',
  'errors.network.body': "La vidéo n'a pas pu se charger.",
  'errors.network.title': 'Pas de connexion',
  'errors.unavailable.body': 'Elle est peut-être devenue privée, '
    + 'ou a été supprimée sur YouTube.',
  'errors.unavailable.owner': "C'est ta vidéo ? Change le lien dans Mon profil.",
  'errors.unavailable.title': "Cette vidéo n'est plus disponible",
  'form.help': "Colle le lien d'une vidéo YouTube : tes meilleures actions, "
    + 'un match, un entraînement.',
  'form.label': 'Lien YouTube',
  'form.placeholder': 'youtube.com/watch?v=… ou youtu.be/…',
  'form.previewHint': "Appuie sur lecture pour vérifier qu'elle se lit bien ici, "
    + "avant d'enregistrer.",
  'form.privacy': 'FoundClub garde seulement le lien : la vidéo reste sur YouTube. '
    + 'Elle est vue par les mêmes personnes que ton profil ; '
    + 'si ton compte est privé, elle est cachée aussi.',
  'form.recognized': 'Lien YouTube reconnu',
  'form.remove': 'Retirer la vidéo',
  'form.removedNotice': 'La vidéo quittera ton profil quand tu enregistreras. '
    + "Elle reste sur ta chaîne YouTube : FoundClub ne l'a jamais copiée.",
  'form.shareTip': 'Sur YouTube, touche « Partager » sous la vidéo, puis « Copier le lien ».',
  'form.undoTip': "Changé d'avis ? « Annuler », en bas, la remet.",
  openInYoutube: 'Ouvrir dans YouTube',
  play: 'Lire la vidéo',
  retry: 'Réessayer',
  sectionTitle: 'Ma vidéo',
};

/**
 * Le texte traduit de la vidéo du profil.
 * @param {keyof typeof REPLIS} cle - Le chemin sous `videoCv`.
 * @returns {string}
 */
const texteVideoCv = (cle) => i18next.t(`videoCv.${cle}`, REPLIS[cle]);

export default texteVideoCv;
