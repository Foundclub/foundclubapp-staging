/**
 * RWDIRIG (29/10) — LE FICHIER À CONFIER À UN `FormData`, TÉLÉPHONE COMME SITE.
 *
 * Au téléphone, `FormData.append` reçoit la forme `{ uri, name, type }` et c'est le moteur
 * natif qui lit le fichier. Sur le site, le `FormData` du navigateur écrit cette forme
 * « [object Object] » : le serveur recevait un envoi VIDE (« Files are empty », vu par Adel en
 * production sur le logo du club). Les choix d'image du site (`SelectAvatar.web.js`, le
 * sélecteur `react-native-image-picker` du site) rendent le VRAI fichier dans `file` : c'est
 * lui qu'on envoie.
 * @param {any} picked - L'image ou le fichier choisi.
 * @param {any} descriptor - La forme `{ uri, name, type }` du téléphone.
 * @returns {any} Ce que reçoit `FormData.append`.
 */
export const filePart = (picked, descriptor) => (
  typeof File !== 'undefined' && picked?.file instanceof File ? picked.file : descriptor
);

export default filePart;
