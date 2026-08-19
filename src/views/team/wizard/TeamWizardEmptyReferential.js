import { Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

/**
 * LE MOTIF PARTAGE DES QUATRE ETAPES DE REFERENTIEL (lot W06).
 *
 * Les etapes 3 a 6 du tunnel equipe — Section, Sport, Categorie, Niveau — lisent
 * QUATRE TABLES GLOBALES, sans le moindre filtre : `/sections`, `/activities`,
 * `/categories`, `/levels` (pagination 200 a 1000, tri par nom, rien d'autre).
 * Mesure du 2026-08-19, qui tranche la question « pourquoi une liste serait-elle
 * vide ? » :
 *
 *  · ⛔ PAS un filtre trop etroit : il n'y a AUCUN filtre. Seul l'ecran Sport
 *    porte une recherche locale, et elle a deja sa phrase a elle.
 *  · ⛔ PAS une panne silencieuse : une coupure reseau, un refus de droits ou
 *    une seule ligne malformee font LEVER le service (`Failed to fetch …`,
 *    validation Joi). L'ecran passe alors par `error`, qui est deja traite et
 *    qui garde son bouton « Réessayer ».
 *  · ✅ La SEULE route vers une liste vide est une table reellement vide. Les
 *    quatre referentiels sont peuples par un seed MANUEL
 *    (`npm run seed:cat-lvl-sections`), jamais appele au demarrage, et garde par
 *    un drapeau `initHasRun` que le script POSE AVANT d'importer : un import qui
 *    echoue laisse la table vide POUR TOUJOURS, sans rattrapage automatique.
 *    Et les quatre content-types sont en `draftAndPublish: false` — pas de
 *    piege « cree mais non publie » non plus.
 *
 * ⇒ La liste est vide STRUCTURELLEMENT, pas par accident. « Réessayer » ne
 *   pourrait rien changer : ce serait un faux espoir, et ce serait dire la meme
 *   chose que le cas erreur. L'issue est de PASSER l'etape.
 *
 * ⇒ Et le serveur l'autorise : dans `admin/src/api/team/content-types/team`,
 *   `section`, `category`, `level` et `activities` sont des relations
 *   OPTIONNELLES (seul `name` porte `required: true`), et `TeamWizardRecap`
 *   poste deja `undefined` pour une valeur absente.
 *
 * 🧾 CE QUI RESTE AU SERVEUR, et que ce lot ne touche pas (§ interdits W06) :
 * un referentiel vide reste un defaut d'approvisionnement cote `admin`. Ce
 * fichier ne fait que rendre le tunnel FRANCHISSABLE en attendant.
 */

/**
 * La liste de cette etape est-elle vide, sans erreur et sans chargement ?
 *
 * ⚠️ Les trois etats sont EXCLUSIFS : tant que la requete charge ou qu'elle a
 * echoue, la liste n'est pas « vide », elle est « pas encore la ». Confondre les
 * deux ferait clignoter « Continuer sans … » a chaque ouverture d'ecran.
 * @param {{ data?: any, error?: any, isLoading?: boolean }} query Le resultat de la requete.
 * @returns {boolean} Vrai seulement si le referentiel a repondu, et qu'il est vide.
 */
export const isReferentialEmpty = (query) => {
  if (!query || query.isLoading || query.error) return false;
  const items = query.data;
  if (!Array.isArray(items)) return false;
  return items.length === 0;
};

/**
 * Ce que le bouton du bas doit faire a une etape de referentiel.
 *
 * 📌 Meme forme que le correctif V02 sur « quelle equipe entraines-tu ? » : sans
 * rien a cocher, le bouton principal N'ATTEND PLUS un choix, il CEDE SA PLACE a
 * la seule action qui fait avancer. ⛔ Surtout pas un petit lien « passer cette
 * etape » qu'il faut deviner — c'est exactement ce que V02 a retire.
 * @param {object} params Les entrees de la decision.
 * @param {boolean} params.hasSelection L'utilisateur a-t-il deja choisi une valeur ?
 * @param {boolean} params.isBlocked Chargement, erreur ou club manquant.
 * @param {boolean} params.isEmpty Sortie de `isReferentialEmpty`.
 * @param {string} params.nextLabel Libelle normal du bouton.
 * @param {string} params.skipLabel Libelle quand il n'y a rien a choisir.
 * @returns {{ isNextDisabled: boolean, nextLabel: string }} Les proprietes du gabarit.
 */
export const getStepFooterProps = ({
  hasSelection,
  isBlocked,
  isEmpty,
  nextLabel,
  skipLabel,
}) => {
  if (isEmpty) {
    return { isNextDisabled: false, nextLabel: skipLabel };
  }
  return { isNextDisabled: !hasSelection || isBlocked, nextLabel };
};

/**
 * L'EXPLICATION PARTAGEE. Elle est ici, en UN exemplaire : chaque etape ne dit
 * que ce qui lui manque, et cette phrase-la ne peut pas diverger entre les
 * quatre. Elle repond a la question que la personne se pose vraiment : « c'est
 * mon club qui est mal rempli ? » — non, c'est un referentiel commun.
 */
const EXPLICATION_PARTAGEE = 'Cette liste est commune à toute l’application : '
  + 'ce n’est pas ton club qui manque quelque chose. Tu pourras la renseigner '
  + 'plus tard, depuis la fiche de l’équipe.';

/**
 * Le bloc affiche quand un referentiel est vide.
 *
 * ⛔ Il ne porte AUCUN bouton : l'action est le bouton du bas, et deux boutons
 * qui font la meme chose sur le meme ecran se volent l'attention. Le cas erreur,
 * lui, garde son « Réessayer » — c'est ce qui distingue les deux a l'oeil nu.
 * @param {object} root0 Les proprietes.
 * @param {string} root0.missing Ce qui manque, dit avec les mots de l'etape.
 * @returns {import('react').ReactElement} Le bloc a inserer dans le corps de l'etape.
 */
function TeamWizardEmptyReferential({ missing }) {
  const { Fonts, Spaces } = useTheme();

  return (
    <View style={[Spaces.gap[8], Spaces.marginBottom[16]]}>
      <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
        {missing}
      </Text>
      <Text style={[Fonts.p2, Fonts.neutral100]}>
        {EXPLICATION_PARTAGEE}
      </Text>
    </View>
  );
}

export default TeamWizardEmptyReferential;
