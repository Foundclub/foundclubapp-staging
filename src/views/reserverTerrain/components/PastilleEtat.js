import { useTranslation } from 'react-i18next';
import { Image, Text, View } from 'react-native';

import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import GlyphIcon from '@/components/atoms/glyphIcon/GlyphIcon';

import texteInsecable from '@/utils/texteInsecable';

/**
 * @typedef {{ couleur: string, encre?: string, icone: string, mot: string, pleine?: boolean,
 *   pointillee?: boolean }} Apparence
 */

/**
 * L'ÉTAT D'UNE RÉSERVATION, EN PASTILLE — RESA-L6A (14/10/2026), planche P00 bloc 4 (plan §1.2) :
 * teintée tant qu'elle est en cours ou à venir, pleine une fois le créneau passé, pointillée
 * quand elle n'a pas eu lieu ; le mot est toujours écrit. Vert : confirmée, jouée ; orange : en
 * attente ; rouge : refusée, annulée ; cyan pâle en pointillé : sans réponse (« moins de gris ») ;
 * rouge plein, encre blanche, drapeau : non honorée (RESA-L6B-1, planche EP10 `pe-nonhonoree`).
 * RESA-L6B-2 (serveur RESA-L3) : « En collecte · 6/10 » (cyan, personnes ; resa.css `pe-collecte`),
 * « Non aboutie » (pâle, pointillée, `pe-pale`), « Annulée » (un participant ne sait pas qui).
 * @param {object} props - Les propriétés.
 * @param {string | null} [props.compte] - « 6/10 » : les présents sur le nombre requis (collecte).
 * @param {string} props.etat - `etatAffiche` (domains/complexe/reserverTerrain.js).
 * @returns {import('react').ReactElement | null} La pastille, ou rien pour un état inconnu.
 */
function PastilleEtat({ compte = null, etat }) {
  const { t } = useTranslation();
  const {
    Alignments, Colors, Fonts, Images,
  } = useTheme();

  /** @type {Record<string, Apparence>} */
  const etats = {
    annulee: {
      couleur: Colors.error500,
      icone: 'croix',
      mot: t('reserverTerrain.etat.annulee', 'Annulée'),
    },
    annuleeParLeComplexe: {
      couleur: Colors.error500,
      icone: 'croix',
      mot: t('reserverTerrain.etat.annuleeParLeComplexe', 'Annulée par le complexe'),
    },
    annuleeParToi: {
      couleur: Colors.error500,
      icone: 'croix',
      mot: t('reserverTerrain.etat.annuleeParToi', 'Annulée par toi'),
    },
    confirmee: {
      couleur: Colors.success500,
      icone: 'coche',
      mot: t('reserverTerrain.etat.confirmee', 'Confirmée'),
    },
    enAttente: {
      couleur: Colors.warning500,
      icone: 'sablier',
      mot: t('reserverTerrain.etat.enAttente', 'En attente'),
    },
    enCollecte: {
      couleur: Colors.primary500,
      encre: Colors.primary200,
      icone: 'personnes',
      mot: compte
        // « 6/10 » : sans SANS_ECHAPPEMENT, i18next en fait « 6&#x2F;10 » (banc du site, 20/10).
        ? t('reserverTerrain.etat.enCollecteCompte', 'En collecte · {{compte}}', {
          compte,
          ...SANS_ECHAPPEMENT,
        })
        : t('reserverTerrain.etat.enCollecte', 'En collecte'),
    },
    jouee: {
      couleur: Colors.success700,
      icone: 'coche',
      mot: t('reserverTerrain.etat.jouee', 'Jouée'),
      pleine: true,
    },
    nonAboutie: {
      couleur: Colors.primary200,
      icone: 'personnes',
      mot: t('reserverTerrain.etat.nonAboutie', 'Non aboutie'),
      pointillee: true,
    },
    nonHonoree: {
      couleur: Colors.error700,
      encre: Colors.neutral00,
      icone: 'drapeau',
      mot: t('reserverTerrain.etat.nonHonoree', 'Non honorée'),
      pleine: true,
    },
    refusee: {
      couleur: Colors.error500,
      icone: 'croix',
      mot: t('reserverTerrain.etat.refusee', 'Refusée'),
    },
    sansReponse: {
      couleur: Colors.primary200,
      icone: 'sablier',
      mot: t('reserverTerrain.etat.sansReponse', 'Sans réponse'),
      pointillee: true,
    },
  };
  const choisi = etats[etat];
  if (!choisi) return null;
  const encre = choisi.encre || (choisi.pleine ? Colors.neutral900 : choisi.couleur);
  const images = {
    coche: Images.check, croix: Images.close, drapeau: Images.flag, personnes: Images.users,
  };
  const icone = choisi.icone === 'sablier' ? (
    <GlyphIcon color={encre} name="hourglass" size={12} />
  ) : (
    <Image
      source={images[/** @type {'coche' | 'croix' | 'drapeau' | 'personnes'} */ (choisi.icone)]}
      style={[{ height: 12, width: 12 }, { tintColor: encre }]}
    />
  );
  return (
    <View
      style={[
        Alignments.row,
        Alignments.alignCenter,
        {
          alignSelf: 'flex-start',
          backgroundColor: choisi.pleine ? choisi.couleur : withAlpha(choisi.couleur, 0.14),
          borderColor: withAlpha(choisi.couleur, 0.6),
          borderRadius: 999,
          borderStyle: choisi.pointillee ? 'dashed' : 'solid',
          borderWidth: 1,
          gap: 4,
          paddingHorizontal: 8,
          paddingVertical: 2,
        },
      ]}
      testID={`pastille-etat-${etat}`}
    >
      {icone}
      <Text style={[Fonts.p3Bold, { color: encre }]}>{texteInsecable(choisi.mot)}</Text>
    </View>
  );
}

export default PastilleEtat;
