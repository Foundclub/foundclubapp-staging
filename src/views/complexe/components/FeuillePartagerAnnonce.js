import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import { messageDuPartage, peutPartagerLAnnonce } from '@/domains/complexe/annonceDuCanal';
import {
  lignesDesPages,
  messageDeRefusResa,
  plageHoraire,
  titreDuJour,
} from '@/domains/complexe/complexeReservation';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import GlyphIcon from '@/components/atoms/glyphIcon/GlyphIcon';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';

import {
  usePartagerAnnonce,
  useReservationsDuComplexe,
} from '@/services/complexe/complexeQueries';

const FILTRES = { source: 'app', statut: 'confirmee' };

/**
 * 🏟️ RESA-PARTAGER (23/10/2026, A-G32, plan E-G12 :848) — « PARTAGER UNE ANNONCE », la feuille du
 * canal du complexe : les parties à compléter des réservations de SON complexe (de l'app,
 * confirmées, à venir : aujourd'hui puis les jours suivants, dans l'ordre), et un choix les publie
 * en carte dans le canal (la route de « Partager dans mon canal », E-G05). Une ligne qui dit son
 * annonce ne vient que si elle est ouverte (`peutPartagerLAnnonce`). Liste vide : une phrase.
 * Montée seulement quand elle s'ouvre : rien n'est lu avant.
 * ponytail: la première page de chaque vue (20 + 20 réservations) — plafond : un complexe qui a
 * plus de 20 réservations de l'app à venir ; sortie : une route des annonces ouvertes du complexe.
 * @param {{ complexeId: string | null, onFait: (message: string) => void,
 *   onFermer: () => void }} props - Le complexe, le message de réussite, la fermeture.
 * @returns {import('react').ReactElement} La feuille.
 */
function FeuillePartagerAnnonce({ complexeId, onFait, onFermer }) {
  const { t } = useTranslation();
  const { Colors, Fonts } = useTheme();
  const aujourdhui = useReservationsDuComplexe(complexeId, { ...FILTRES, vue: 'aujourdhui' });
  const aVenir = useReservationsDuComplexe(complexeId, { ...FILTRES, vue: 'a-venir' });
  const partager = usePartagerAnnonce();
  const [refus, setRefus] = useState('');

  const maintenant = Date.now();
  const lignes = [...lignesDesPages(aujourdhui.data), ...lignesDesPages(aVenir.data)]
    .filter((/** @type {any} */ ligne) => peutPartagerLAnnonce(ligne, maintenant));
  const chargement = Boolean(aujourdhui.isLoading || aVenir.isLoading);
  const enErreur = Boolean(aujourdhui.isError || aVenir.isError);

  const choisir = async (/** @type {string} */ reservationId) => {
    setRefus('');
    try {
      const reponse = await partager.mutateAsync({ complexeId, reservationId });
      onFait(messageDuPartage(t, reponse));
    } catch (erreur) {
      setRefus(messageDeRefusResa(
        t,
        erreur,
        t('complexeReservations.fiche.erreurGeste', 'Le geste n’a pas pu être fait.'),
      ));
    }
  };

  let corps;
  if (chargement) {
    corps = (
      <View accessibilityState={{ busy: true }} style={{ gap: 8 }} testID="partager-chargement">
        {[0, 1].map((rang) => (
          <View
            key={rang}
            style={{
              backgroundColor: withAlpha(Colors.neutral00, 0.06), borderRadius: 12, height: 56,
            }}
          />
        ))}
      </View>
    );
  } else if (enErreur) {
    corps = (
      <Text accessibilityRole="alert" style={[Fonts.p2Bold, Fonts.error300]}>
        {t('complexeCanal.partager.erreur', 'Impossible de charger tes réservations.')}
      </Text>
    );
  } else if (!lignes.length) {
    corps = (
      <Text style={[Fonts.p2, Fonts.neutral200]} testID="partager-aucune">
        {t(
          'complexeCanal.partager.aucune',
          'Aucune partie à compléter en ce moment. Quand un joueur publie « Il me manque des '
          + 'joueurs » sur une réservation chez toi, elle apparaît ici.',
        )}
      </Text>
    );
  } else {
    corps = (
      <View style={{ gap: 8 }}>
        {lignes.map((/** @type {any} */ ligne) => {
          const quand = `${titreDuJour(ligne.date)} · ${plageHoraire(ligne.from, ligne.to)}`;
          const qui = [ligne.label, ligne.terrain?.name].filter(Boolean).join(' · ');
          return (
            <TouchableOpacity
              accessibilityLabel={`${quand}, ${qui}`}
              accessibilityRole="button"
              accessibilityState={{ disabled: Boolean(partager.isPending) }}
              disabled={Boolean(partager.isPending)}
              key={ligne.documentId}
              onPress={() => choisir(String(ligne.documentId))}
              style={{
                alignItems: 'center',
                backgroundColor: withAlpha(Colors.primary700, 0.45),
                borderColor: withAlpha(Colors.primary500, 0.5),
                borderRadius: 12,
                borderWidth: 1,
                flexDirection: 'row',
                gap: 12,
                minHeight: 56,
                paddingHorizontal: 14,
                paddingVertical: 10,
              }}
              testID={`partager-ligne-${ligne.documentId}`}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{quand}</Text>
                {qui ? <Text style={[Fonts.p3, Fonts.neutral200]}>{qui}</Text> : null}
              </View>
              <GlyphIcon color={Colors.primary200} name="send" size={16} />
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

  return (
    <BottomModal close={onFermer} isVisible webPresentation="dialog">
      <View style={{ gap: 12 }} testID="feuille-partager-annonce">
        <Text accessibilityRole="header" style={[Fonts.h4Bold, Fonts.neutral00]}>
          {t('complexeCanal.partager.titre', 'Partager une annonce')}
        </Text>
        <Text style={[Fonts.p2, Fonts.neutral200]}>
          {t(
            'complexeCanal.partager.choisir',
            'Choisis la partie à compléter : elle arrive en carte dans ton canal.',
          )}
        </Text>
        {refus ? (
          <Text accessibilityRole="alert" style={[Fonts.p2Bold, Fonts.error300]}>{refus}</Text>
        ) : null}
        {corps}
      </View>
    </BottomModal>
  );
}

export default FeuillePartagerAnnonce;
