import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { contenuDEchec, varianteDEchec } from '@/domains/complexe/reserverTerrain';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import InputStepper from '@/components/molecules/inputStepper/InputStepper';

import { useConstruireLaReservation } from '@/services/complexe/complexeJoueurQueries';

/**
 * RESA-JOUEUR (11/11/2026) — E-P07 « Ma réservation » EN CONSTRUCTION, côté réserveur (maquette
 * validée par Adel le 10/11, « 232- ok ») : « 6 sur 10 présents », ce qui manque, la phrase sur le
 * créneau qui peut encore être pris, et deux gestes :
 *   · « On a assez de joueurs » — toujours possible, même incomplet (Adel : « dans tous les cas il
 *     peut dire qu'il a assez de joueurs ») ; la confirmation redit ce que paie le groupe ;
 *   · « J'ai trouvé des joueurs » — des joueurs trouvés hors de l'app : l'annonce se met à jour.
 * Le serveur confirme seul quand le nombre requis est atteint.
 * @param {object} props - Les propriétés.
 * ACCEPTER-CONSTRUCTION (12/11/2026, Adel « 263 A ») : le complexe a accepté (`acceptedAt`, un
 * terrain sur demande) — « Acceptée par … Le créneau t'est gardé » remplace « un autre groupe peut
 * prendre ce créneau ».
 * @param {{ acceptedAt?: string | null, presents?: number, quorum?: number }} props.collecte - La
 *   collecte du groupe.
 * @param {string} [props.complexe] - Le nom du complexe.
 * @param {string} [props.paie] - « Le groupe paie… » (ou '').
 * @param {string} props.reservationId - documentId de la réservation.
 * @returns {import('react').ReactElement} Le bloc.
 */
function BlocConstruction({
  collecte, complexe = '', paie = '', reservationId,
}) {
  const { t } = useTranslation();
  const { Colors, Fonts } = useTheme();
  const construire = useConstruireLaReservation();
  const [ouvert, setOuvert] = useState(/** @type {null | 'assez' | 'trouves'} */ (null));
  const [nombre, setNombre] = useState(1);
  const [refus, setRefus] = useState(/** @type {string | null} */ (null));
  const presents = Number(collecte?.presents) || 0;
  const requis = Number(collecte?.quorum) || 0;
  const manque = Math.max(0, requis - presents);

  const agir = async (/** @type {'assez' | 'trouves'} */ geste) => {
    setRefus(null);
    try {
      await construire.mutateAsync({ geste, nombre, reservationId });
      setOuvert(null);
      setNombre(1);
    } catch (erreur) {
      setRefus(contenuDEchec(t, varianteDEchec(erreur), { erreur }).titre);
    }
  };

  return (
    <View
      style={{
        backgroundColor: withAlpha(Colors.warning500, 0.08),
        borderColor: withAlpha(Colors.warning500, 0.45),
        borderRadius: 20,
        borderWidth: 1,
        gap: 10,
        padding: 16,
      }}
      testID="ma-reservation-construction"
    >
      <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
        {t('reserverTerrain.construction.presents', '{{presents}} sur {{requis}} présents', {
          presents,
          requis,
        })}
      </Text>
      {manque ? (
        <Text style={[Fonts.p2Bold, Fonts.warning500]}>
          {manque > 1
            ? t('reserverTerrain.recapitulatif.ilManqueN', 'Il manque {{nombre}} joueurs.', {
              nombre: manque,
            })
            : t('reserverTerrain.recapitulatif.ilManqueUn', 'Il manque {{nombre}} joueur.', {
              nombre: manque,
            })}
        </Text>
      ) : null}
      {collecte?.acceptedAt ? (
        <Text style={[Fonts.p2Bold, Fonts.neutral00]} testID="ma-reservation-construction-acceptee">
          {t(
            'reserverTerrain.construction.acceptee',
            'Acceptée par {{complexe}}. Le créneau t’est gardé. '
              + 'Dis « On a assez de joueurs » quand ton groupe est prêt.',
            { complexe, ...SANS_ECHAPPEMENT },
          )}
        </Text>
      ) : (
        <Text style={[Fonts.p3, Fonts.neutral100]}>
          {t(
            'reserverTerrain.recapitulatif.creneauOuvert',
            'Tant que ce n’est pas confirmé, un autre groupe peut prendre ce créneau.',
          )}
        </Text>
      )}
      {refus ? (
        <Text accessibilityRole="alert" style={[Fonts.p2Bold, Fonts.error500]}>{refus}</Text>
      ) : null}
      {ouvert === 'assez' ? (
        <View style={{ gap: 8 }} testID="construction-confirmer">
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
            {t('reserverTerrain.construction.assezQuestion', 'Vous avez assez de joueurs ?')}
          </Text>
          {paie ? <Text style={[Fonts.p3, Fonts.neutral100]}>{paie}</Text> : null}
          <Button
            isLoading={Boolean(construire?.isPending)}
            onPress={() => agir('assez')}
            title={t('reserverTerrain.construction.ouiAssez', 'Oui, on a assez de joueurs')}
            variant="Primary"
          />
          <Button
            onPress={() => setOuvert(null)}
            title={t('reserverTerrain.construction.pasEncore', 'Pas encore')}
            variant="Ghost"
          />
        </View>
      ) : null}
      {ouvert === 'trouves' ? (
        <View style={{ gap: 8 }} testID="construction-trouves">
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
            {t(
              'reserverTerrain.construction.combienEnPlus',
              'Combien en plus, trouvés en dehors de l’app ?',
            )}
          </Text>
          <InputStepper
            decrementLabel={t('reserverTerrain.recapitulatif.moins', 'Un joueur de moins')}
            incrementLabel={t('reserverTerrain.recapitulatif.plus', 'Un joueur de plus')}
            max={Math.max(1, manque)}
            min={1}
            onDecrement={() => setNombre((avant) => Math.max(1, avant - 1))}
            onIncrement={() => setNombre((avant) => Math.min(Math.max(1, manque), avant + 1))}
            tone="tunnel"
            value={nombre}
          />
          <Button
            isLoading={Boolean(construire?.isPending)}
            onPress={() => agir('trouves')}
            title={t('reserverTerrain.construction.mettreAJour', 'Mettre à jour l’annonce')}
            variant="Primary"
          />
          <Button
            onPress={() => setOuvert(null)}
            title={t('reserverTerrain.telephone.fermer', 'Fermer')}
            variant="Ghost"
          />
        </View>
      ) : null}
      {ouvert ? null : (
        <View style={{ gap: 8 }}>
          <Button
            onPress={() => setOuvert('assez')}
            title={t('reserverTerrain.recapitulatif.assezDeJoueurs', 'On a assez de joueurs')}
            variant="Primary"
          />
          {manque ? (
            <Button
              onPress={() => setOuvert('trouves')}
              title={t('reserverTerrain.construction.jaiTrouve', 'J’ai trouvé des joueurs')}
              variant="Secondary"
            />
          ) : null}
        </View>
      )}
    </View>
  );
}

export default BlocConstruction;
