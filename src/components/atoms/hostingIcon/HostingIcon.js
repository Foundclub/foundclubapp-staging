import { Image, View } from 'react-native';

import useTheme from '@/theme/themeContext';

/**
 * Le pictogramme d un etat de lieu (« qui recoit »), a partir de la seule cle
 * rendue par getHostingTag(). Il vit ici, et pas dans chaque ecran, parce que
 * l etat de lieu s affiche a deux endroits qui n ont rien d autre en commun :
 * la carte-option de l etape 2/7 du tunnel (tuile de 38 pt) et le tag en
 * contour de la carte d annonce (11 pt). Deux dessins recopies derivent deux
 * fois.
 *
 * ⚠️ L icone n est JAMAIS seule : ses deux appelants affichent toujours le
 * libelle a cote. Un pictogramme sans texte s interprete mal, et la couleur
 * seule ne dit rien a qui ne la distingue pas.
 * @param {object} props
 * @param {string} props.color - Teinte appliquee au trait.
 * @param {string} props.iconKey - Cle getHostingTag : stadium, running, switch ou none.
 * @param {number} props.size - Cote du pictogramme, en points.
 * @returns {import('react').ReactElement | null}
 */
function HostingIcon({ color, iconKey, size }) {
  const { Images } = /** @type {any} */ (useTheme());

  if (iconKey === 'none') return null;

  // ponytail: la maquette demande le glyphe « ⇄ » (SwitchHorizontal). Le depot
  // n a pas cet asset, et ce lot n ajoute aucun fichier binaire. On l ecrit donc
  // avec les deux fleches qui existent deja, empilees : c est le meme dessin.
  // Voie de sortie : un seul PNG « ⇄ » dans src/assets/icons, et ce bloc tombe.
  if (iconKey === 'switch') {
    const arrowHeight = Math.round(size * 0.46);
    return (
      <View style={{
        alignItems: 'center', height: size, justifyContent: 'center', width: size,
      }}
      >
        <Image
          source={Images.arrowRight}
          style={{
            height: arrowHeight, resizeMode: 'contain', tintColor: color, width: size,
          }}
        />
        <Image
          source={Images.arrowLeft}
          style={{
            height: arrowHeight, resizeMode: 'contain', tintColor: color, width: size,
          }}
        />
      </View>
    );
  }

  return (
    <Image
      source={iconKey === 'stadium' ? Images.stadium : Images.running}
      style={{
        height: size, resizeMode: 'contain', tintColor: color, width: size,
      }}
    />
  );
}

export default HostingIcon;
