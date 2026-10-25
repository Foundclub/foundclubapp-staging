import { useTranslation } from 'react-i18next';
import { Image, Text, View } from 'react-native';

import { numeroLisible } from '@/domains/complexe/reserverTerrain';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import GlyphIcon from '@/components/atoms/glyphIcon/GlyphIcon';

import texteInsecable from '@/utils/texteInsecable';

const PICTO = 72;

/**
 * LE GABARIT D'UN ÉCHEC — RESA-L6A (14/10/2026), planche EP13 (« Gabarit commun ») : un pictogramme
 * dans un rond (icônes du système, jamais d'emoji : cyan pour l'âge et le plafond, orange pour un
 * délai ou une fermeture, rouge pour un refus, une annulation, un bannissement), le titre, le
 * texte, la carte de la réservation quand il y en a une (`children`), et les boutons empilés que
 * nomme le contenu (`contenuDEchec`). Sert E-P13 et l'en-tête d'une réservation refusée ou annulée
 * (E-P07).
 * @param {object} props - Les propriétés.
 * @param {import('react').ReactNode} [props.children] - La carte de la réservation.
 * @param {{ actions: string[], icone: string, telephone: string | null, texte: string | null,
 *   titre: string, ton: 'cyan' | 'orange' | 'rouge' }} props.contenu - La variante.
 * @param {(action: string) => void} props.onAction - Une action touchée (sa clef).
 * @returns {import('react').ReactElement} Le bloc.
 */
function BlocDEchec({ children = null, contenu, onAction }) {
  const { t } = useTranslation();
  const {
    Alignments, Colors, Fonts, Images,
  } = useTheme();
  let couleur = Colors.error500;
  if (contenu.ton === 'cyan') couleur = Colors.primary500;
  else if (contenu.ton === 'orange') couleur = Colors.warning500;

  const sources = /** @type {Record<string, any>} */ ({
    calendrier: Images.calendar,
    coche: Images.check,
    croix: Images.close,
    horloge: Images.clock,
    personnes: Images.users,
    tel: Images.phone,
  });
  let picto;
  if (contenu.icone === 'sablier') picto = <GlyphIcon color={couleur} name="hourglass" size={32} />;
  else if (contenu.icone === 'interdit') picto = <GlyphIcon color={couleur} name="ban" size={32} />;
  else {
    picto = (
      <Image
        source={sources[contenu.icone] || Images.close}
        style={{ height: 32, tintColor: couleur, width: 32 }}
      />
    );
  }

  /** @type {Record<string, string>} */
  const libelles = {
    ailleurs: t('reserverTerrain.echec.reserverAilleurs', 'Réserver ailleurs'),
    appeler: contenu.telephone
      ? t('reserverTerrain.telephone.appeler', 'Appeler le {{numero}}', {
        numero: numeroLisible(contenu.telephone),
        ...SANS_ECHAPPEMENT,
      })
      : '',
    autreJour: t('reserverTerrain.echec.autreJour', 'Réserver un autre jour'),
    autresCreneaux: t('reserverTerrain.echec.autresCreneaux', 'Voir d’autres créneaux'),
    // RESA-L6B-2 : la conversation de la réservation (refusée, annulée par le complexe), E-P10.
    ecrire: t('reserverTerrain.maReservation.ecrireAuComplexe', 'Écrire au complexe'),
    mesReservations: t('reserverTerrain.echec.voirMesReservations', 'Voir mes réservations'),
    profil: t('reserverTerrain.echec.completerProfil', 'Compléter mon profil'),
    reessayer: t('reserverTerrain.recherche.reessayer', 'Réessayer'),
    // RESA-L6B-2 : la collecte arrêtée à sa date limite, la partie annulée par son réserveur.
    relancer: t('reserverTerrain.echec.relancer', 'Relancer sur un autre créneau'),
    reserverUnTerrain: t('reserverTerrain.echec.reserverUnTerrain', 'Réserver un terrain'),
  };

  return (
    <View style={{ alignItems: 'center', gap: 16 }}>
      <View
        style={[
          Alignments.alignCenter,
          Alignments.justifyCenter,
          {
            backgroundColor: withAlpha(couleur, 0.16),
            borderRadius: PICTO / 2,
            height: PICTO,
            width: PICTO,
          },
        ]}
      >
        {picto}
      </View>
      <Text accessibilityRole="header" style={[Fonts.h3Black, Fonts.neutral00, Fonts.textCenter]}>
        {contenu.titre}
      </Text>
      {contenu.texte ? (
        <Text style={[Fonts.p1, Fonts.neutral100, Fonts.textCenter]}>{contenu.texte}</Text>
      ) : null}
      {children}
      {contenu.actions.length ? (
        <View style={{ alignSelf: 'stretch', gap: 10 }}>
          {contenu.actions
            .filter((action) => libelles[action])
            .map((action, rang) => (
              <Button
                icon={action === 'appeler' ? 'phone' : undefined}
                key={action}
                onPress={() => onAction(action)}
                title={texteInsecable(libelles[action])}
                variant={rang === 0 ? 'Primary' : 'Secondary'}
              />
            ))}
        </View>
      ) : null}
    </View>
  );
}

export default BlocDEchec;
