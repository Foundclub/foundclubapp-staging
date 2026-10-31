import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { messageDeRefusResa } from '@/domains/complexe/complexeReservation';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';

import { useApercuRetrait, useRetirerTerrain } from '@/services/complexe/complexeQueries';

/**
 * « RETIRER UN TERRAIN » — RESA-L5A2 (14/10/2026), planches E-G07 (menu « … ») et E-G08
 * (« Retirer ce terrain ») : la feuille compte d'abord, sans rien écrire, les réservations à
 * venir que le retrait annulerait (`dryRun` du serveur RESA-L2A), puis « Retirer » : le terrain
 * n'est plus réservable, son historique est gardé, ses réservations à venir sont annulées et
 * leurs joueurs prévenus (N-18).
 * @param {object} props - Les propriétés.
 * @param {string | null} props.complexeId - Le complexe.
 * @param {() => void} props.onFermer - Fermer sans rien faire.
 * @param {(bilan: { annulees: number, nom: string }) => void} props.onRetire - Après le retrait.
 * @param {any} props.terrain - Le terrain à retirer ; null : la feuille est fermée.
 * @returns {import('react').ReactElement} La feuille.
 */
function FeuilleRetrait({
  complexeId, onFermer, onRetire, terrain,
}) {
  const { t } = useTranslation();
  const { Fonts } = useTheme();
  const apercu = useApercuRetrait();
  const retirer = useRetirerTerrain();
  const [compte, setCompte] = useState(/** @type {number | null} */ (null));
  // CORR-RESA (69 A) : les collectes à venir que le retrait arrêtera (serveur `collectesTouchees`).
  const [collectes, setCollectes] = useState(0);
  const [erreur, setErreur] = useState('');
  const terrainId = terrain?.documentId || null;
  const nom = String(terrain?.name || '');
  const repli = t('complexeReservations.retrait.erreur', 'Le terrain n’a pas pu être retiré.');

  useEffect(() => {
    if (!terrainId) return;
    setCompte(null);
    setCollectes(0);
    setErreur('');
    Promise.resolve(apercu.mutateAsync({ complexeId, terrainId }))
      .then((reponse) => {
        setCollectes(Number(reponse?.data?.collectesTouchees) || 0);
        setCompte(Number(reponse?.data?.reservationsTouchees) || 0);
      })
      .catch((refus) => setErreur(messageDeRefusResa(t, refus, repli)));
    // Une lecture par ouverture : la mutation et la traduction ne la relancent pas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complexeId, terrainId]);

  const confirmer = async () => {
    setErreur('');
    try {
      const reponse = await retirer.mutateAsync({ complexeId, terrainId });
      onRetire({ annulees: Number(reponse?.data?.reservationsAnnulees) || 0, nom });
    } catch (refus) {
      setErreur(messageDeRefusResa(t, refus, repli));
    }
  };

  let effet = t('complexeReservations.retrait.compte', 'On compte ses réservations à venir…');
  if (compte === 0) {
    effet = t('complexeReservations.retrait.aucune', 'Aucune réservation à venir sur ce terrain.');
  } else if (compte) {
    effet = t(
      'complexeReservations.retrait.annulees',
      '{{count}} réservations à venir seront annulées et les joueurs prévenus.',
      {
        count: compte,
        defaultValue_one: '{{count}} réservation à venir sera annulée et le joueur prévenu.',
        defaultValue_other:
          '{{count}} réservations à venir seront annulées et les joueurs prévenus.',
        ...SANS_ECHAPPEMENT,
      },
    );
  }
  if (compte !== null && collectes > 0) {
    effet = `${effet} ${t('complexeReservations.retrait.collectes', {
      count: collectes,
      defaultValue_one: '{{count}} collecte en cours s’arrêtera et ses joueurs seront prévenus.',
      defaultValue_other:
        '{{count}} collectes en cours s’arrêteront et leurs joueurs seront prévenus.',
      ...SANS_ECHAPPEMENT,
    })}`;
  }

  return (
    <BottomModal close={onFermer} isVisible={Boolean(terrainId)} webPresentation="dialog">
      <View style={{ gap: 16 }} testID="feuille-retrait">
        <Text accessibilityRole="header" style={[Fonts.h4Bold, Fonts.neutral00]}>
          {t(
            'complexeReservations.retrait.titre',
            'Retirer {{nom}} ?',
            { nom, ...SANS_ECHAPPEMENT },
          )}
        </Text>
        <Text style={[Fonts.p2, Fonts.neutral100]}>{effet}</Text>
        <Text style={[Fonts.p3, Fonts.neutral200]}>
          {t(
            'complexeReservations.retrait.dit',
            'Il ne sera plus réservable ; son historique est gardé.',
          )}
        </Text>
        {erreur ? (
          <Text accessibilityRole="alert" style={[Fonts.p2Bold, Fonts.error300]}>{erreur}</Text>
        ) : null}
        <View testID="retrait-confirmer">
          <Button
            disabled={compte === null || Boolean(retirer.isPending)}
            isLoading={Boolean(retirer.isPending)}
            onPress={confirmer}
            title={t('complexeReservations.retrait.retirer', 'Retirer')}
            variant="DangerFilled"
          />
        </View>
        <Button
          onPress={onFermer}
          title={t('complexeReservations.fiche.garder', 'Garder')}
          variant="Ghost"
        />
      </View>
    </BottomModal>
  );
}

export default FeuilleRetrait;
