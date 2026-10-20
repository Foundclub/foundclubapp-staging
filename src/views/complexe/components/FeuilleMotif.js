import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import { MOTIFS_DE_REFUS } from '@/domains/complexe/complexeReservation';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import Input from '@/components/molecules/input/Input';

/**
 * LA FEUILLE DU MOTIF — RESA-L5A2 (14/10/2026), planches E-G05 états 3 et 5, E-G06 : « Refuser la
 * demande de Lina T. » (trois motifs en un appui qui remplissent le champ, qu'on peut compléter ;
 * modèle `DecisionCreneauModal` des Villes) et « Annuler la réservation de Julien M. ? » (motif
 * obligatoire). Le bouton rouge reste éteint tant qu'un motif obligatoire manque ; le refus du
 * serveur s'écrit dans la feuille, qui reste ouverte.
 * @param {object} props - Les propriétés.
 * @param {string} [props.erreur] - Le refus du serveur, déjà rédigé.
 * @param {boolean} [props.enCours] - L'envoi est en cours.
 * @param {string} props.libelleChamp - « Motif », « Un mot pour Lina ».
 * @param {string} props.libelleConfirmer - « Refuser », « Annuler ».
 * @param {string} [props.libelleGarder] - « Annuler », « Garder ».
 * @param {boolean} [props.motifs] - Les 4 motifs en un appui.
 * @param {boolean} [props.obligatoire] - Le motif est obligatoire.
 * @param {(motif: string) => void} props.onConfirmer - Le geste, avec le motif.
 * @param {() => void} props.onFermer - Fermer sans rien faire.
 * @param {string} [props.sousTitre] - Le rappel : « Dimanche 19/10 · 10 h – 11 h · Terrain 2 ».
 * @param {string} props.titre - « Refuser la demande de Lina T. ».
 * @param {boolean} props.visible - Ouverte ou non.
 * @returns {import('react').ReactElement} La feuille.
 */
function FeuilleMotif({
  enCours = false,
  erreur = '',
  libelleChamp,
  libelleConfirmer,
  libelleGarder = undefined,
  motifs = false,
  obligatoire = false,
  onConfirmer,
  onFermer,
  sousTitre = '',
  titre,
  visible,
}) {
  const { t } = useTranslation();
  const { Alignments, Colors, Fonts } = useTheme();
  const [motif, setMotif] = useState('');
  const [choisi, setChoisi] = useState('');

  // Chaque ouverture repart d'une feuille vide.
  useEffect(() => {
    if (visible) {
      setMotif('');
      setChoisi('');
    }
  }, [visible]);

  const texte = motif.replace(/\s+/g, ' ').trim();
  const eteint = enCours || (obligatoire && !texte);

  return (
    <BottomModal close={onFermer} isVisible={visible} webPresentation="dialog">
      <View style={{ gap: 16 }} testID="feuille-motif">
        <View style={{ gap: 4 }}>
          <Text accessibilityRole="header" style={[Fonts.h4Bold, Fonts.neutral00]}>{titre}</Text>
          {sousTitre ? <Text style={[Fonts.p2, Fonts.neutral200]}>{sousTitre}</Text> : null}
        </View>
        {motifs ? (
          <View style={[Alignments.row, Alignments.wrap, { gap: 8 }]}>
            {MOTIFS_DE_REFUS.map((option) => {
              const actif = choisi === option.cle;
              return (
                <TouchableOpacity
                  accessibilityRole="radio"
                  accessibilityState={{ checked: actif }}
                  key={option.cle}
                  onPress={() => {
                    setChoisi(option.cle);
                    setMotif(option.cle === 'autre' ? '' : option.texte(t));
                  }}
                  style={[
                    Alignments.justifyCenter,
                    {
                      backgroundColor: actif ? withAlpha(Colors.primary500, 0.2) : 'transparent',
                      borderColor: actif ? Colors.primary500 : withAlpha(Colors.primary500, 0.4),
                      borderRadius: 999,
                      borderWidth: 1,
                      minHeight: 44,
                      paddingHorizontal: 14,
                    },
                  ]}
                >
                  <Text style={[Fonts.p3Bold, actif ? Fonts.neutral00 : Fonts.primary200]}>
                    {option.texte(t)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}
        <Input
          label={libelleChamp}
          multiline
          onChangeText={setMotif}
          value={motif}
        />
        {erreur ? (
          <Text accessibilityRole="alert" style={[Fonts.p2Bold, Fonts.error300]}>{erreur}</Text>
        ) : null}
        <View style={[Alignments.row, Alignments.wrap, { gap: 8 }]}>
          <View style={{ flexBasis: 140, flexGrow: 1 }}>
            <Button
              onPress={onFermer}
              title={libelleGarder || t('complexeReservations.feuille.annuler', 'Annuler')}
              variant="Ghost"
            />
          </View>
          <View style={{ flexBasis: 140, flexGrow: 1 }}>
            <Button
              disabled={eteint}
              isLoading={enCours}
              onPress={() => onConfirmer(texte)}
              title={libelleConfirmer}
              variant="DangerFilled"
            />
          </View>
        </View>
      </View>
    </BottomModal>
  );
}

export default FeuilleMotif;
