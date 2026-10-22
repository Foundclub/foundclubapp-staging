import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import { contenuDEchec, varianteDEchec } from '@/domains/complexe/reserverTerrain';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';

import { useSignalerUnComplexe } from '@/services/complexe/complexeJoueurQueries';

/** Les motifs du serveur (`MOTIFS_SIGNALEMENT`, liste fermée), dans l'ordre de la planche. */
const MOTIFS = Object.freeze([
  'inexistant', 'informations-fausses', 'comportement-abusif', 'autre',
]);

/**
 * « … » PUIS « SIGNALER CE COMPLEXE » — RESA-L6B-2 (20/10/2026), serveur RESA-L4, planche EP02
 * état 3, plan E-P02 (D6, RC-G16, N-09). Le menu « … » (une action), puis la feuille : « Dis-nous
 * ce qui ne va pas. Le complexe ne sait pas qui l'a signalé. », le motif (liste fermée du
 * serveur), « Annuler » / « Envoyer » ; envoyé : « Merci, FoundClub va regarder. » (le
 * signalement prévient le SuperAdmin, N-09).
 * @param {object} props - Les propriétés.
 * @param {() => void} props.onFermer - La feuille fermée.
 * @param {string} props.slug - L'adresse publique du complexe.
 * @param {boolean} props.visible - Ouverte (le menu « … »).
 * @returns {import('react').ReactElement} La feuille.
 */
function FeuilleSignaler({ onFermer, slug, visible }) {
  const { t } = useTranslation();
  const { Alignments, Colors, Fonts } = useTheme();
  const signaler = useSignalerUnComplexe();
  const [etape, setEtape] = useState(/** @type {'menu' | 'motif' | 'merci'} */ ('menu'));
  const [motif, setMotif] = useState(/** @type {string | null} */ (null));
  const [refus, setRefus] = useState(/** @type {string | null} */ (null));

  const libelles = /** @type {Record<string, string>} */ ({
    autre: t('reserverTerrain.signaler.autre', 'Autre'),
    'comportement-abusif': t('reserverTerrain.signaler.comportementAbusif', 'Comportement abusif'),
    inexistant: t('reserverTerrain.signaler.inexistant', 'Ce complexe n’existe pas'),
    'informations-fausses': t(
      'reserverTerrain.signaler.informationsFausses',
      'Informations fausses',
    ),
  });
  const fermer = () => {
    setEtape('menu');
    setMotif(null);
    setRefus(null);
    onFermer();
  };
  const envoyer = async () => {
    if (!motif) return;
    setRefus(null);
    try {
      await signaler.mutateAsync({ complexe: slug, motif });
      setEtape('merci');
    } catch (erreur) {
      setRefus(contenuDEchec(t, varianteDEchec(erreur), { erreur }).titre);
    }
  };

  let contenu;
  if (etape === 'menu') {
    contenu = (
      <TouchableOpacity
        accessibilityRole="button"
        onPress={() => setEtape('motif')}
        style={{ justifyContent: 'center', minHeight: 48 }}
        testID="complexe-signaler"
      >
        <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
          {t('reserverTerrain.signaler.titre', 'Signaler ce complexe')}
        </Text>
      </TouchableOpacity>
    );
  } else if (etape === 'merci') {
    contenu = (
      <View style={{ gap: 12 }}>
        <Text accessibilityLiveRegion="polite" style={[Fonts.p1Bold, Fonts.neutral00]}>
          {t('reserverTerrain.signaler.merci', 'Merci, FoundClub va regarder.')}
        </Text>
        <Button
          onPress={fermer}
          title={t('reserverTerrain.telephone.fermer', 'Fermer')}
          variant="Secondary"
        />
      </View>
    );
  } else {
    contenu = (
      <View style={{ gap: 12 }}>
        <Text accessibilityRole="header" style={[Fonts.h4Bold, Fonts.neutral00]}>
          {t('reserverTerrain.signaler.titre', 'Signaler ce complexe')}
        </Text>
        <Text style={[Fonts.p2, Fonts.neutral100]}>
          {t(
            'reserverTerrain.signaler.explication',
            'Dis-nous ce qui ne va pas. Le complexe ne sait pas qui l’a signalé.',
          )}
        </Text>
        {MOTIFS.map((cle) => (
          <TouchableOpacity
            accessibilityLabel={libelles[cle]}
            accessibilityRole="radio"
            accessibilityState={{ checked: motif === cle }}
            key={cle}
            onPress={() => setMotif(cle)}
            style={[
              Alignments.row,
              Alignments.alignCenter,
              {
                backgroundColor: withAlpha(Colors.primary800, 0.6),
                borderColor: motif === cle ? Colors.primary500 : withAlpha(Colors.primary500, 0.24),
                borderRadius: 14,
                borderWidth: 1,
                gap: 12,
                minHeight: 48,
                paddingHorizontal: 14,
              },
            ]}
            testID={`signaler-motif-${cle}`}
          >
            <View
              style={{
                alignItems: 'center',
                borderColor: motif === cle ? Colors.primary500 : Colors.primary200,
                borderRadius: 11,
                borderWidth: 2,
                height: 22,
                justifyContent: 'center',
                width: 22,
              }}
            >
              {motif === cle ? (
                <View
                  style={{
                    backgroundColor: Colors.primary500, borderRadius: 6, height: 12, width: 12,
                  }}
                />
              ) : null}
            </View>
            <Text style={[Fonts.p2, Fonts.neutral00, { flex: 1 }]}>{libelles[cle]}</Text>
          </TouchableOpacity>
        ))}
        {refus ? (
          <Text accessibilityRole="alert" style={[Fonts.p2Bold, Fonts.error300]}>{refus}</Text>
        ) : null}
        <View style={[Alignments.row, { gap: 10 }]}>
          <View style={{ flex: 1 }}>
            <Button
              onPress={fermer}
              title={t('reserverTerrain.signaler.annuler', 'Annuler')}
              variant="Ghost"
            />
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={{ busy: Boolean(signaler?.isPending), disabled: !motif }}
            disabled={!motif || Boolean(signaler?.isPending)}
            onPress={envoyer}
            style={{
              alignItems: 'center',
              backgroundColor: motif ? Colors.primary500 : withAlpha(Colors.primary500, 0.3),
              borderRadius: 12,
              flex: 1,
              justifyContent: 'center',
              minHeight: 48,
            }}
            testID="signaler-envoyer"
          >
            <Text style={[Fonts.p2Bold, Fonts.primary900]}>
              {t('reserverTerrain.signaler.envoyer', 'Envoyer')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <BottomModal close={fermer} isVisible={visible} webPresentation="dialog">
      {contenu}
    </BottomModal>
  );
}

export default FeuilleSignaler;
