import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import { messageDuPartage, peutPartagerLAnnonce } from '@/domains/complexe/annonceDuCanal';
import {
  lignesDesPages, messageDeRefusResa, plageHoraire, titreDuJour,
} from '@/domains/complexe/complexeReservation';
import {
  partDeLaJauge, texteDuCompteur, texteDuManque,
} from '@/domains/complexe/constructionDuGerant';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import EcrireAuClient from '@/views/complexe/components/EcrireAuClient';

import { RouteNames } from '@/navigation/routeNames';

import { usePartagerAnnonce, useReservationsDuComplexe } from '@/services/complexe/complexeQueries';

/**
 * La jauge orange d'une réservation en construction (« 7 sur 10 »).
 * @param {{ part: number }} props - La part remplie, de 0 à 1.
 * @returns {import('react').ReactElement} La jauge.
 */
export function JaugeDeConstruction({ part }) {
  const { Colors } = useTheme();
  return (
    <View
      style={{
        backgroundColor: withAlpha(Colors.neutral00, 0.12),
        borderRadius: 4,
        height: 8,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          backgroundColor: Colors.warning500,
          borderRadius: 4,
          height: 8,
          width: `${Math.round(part * 100)}%`,
        }}
      />
    </View>
  );
}

/**
 * Une réservation en construction : la toucher ouvre sa fiche ; « Écrire au client », « Partager
 * l'annonce » (dans son canal) ou, sans annonce ouverte, « Voir la fiche ».
 * @param {{ aujourdhui: string, complexeId: string, ligne: any, navigation: any }} props - Le jour,
 *   le complexe, la ligne du serveur (`vue=construction`) et la navigation.
 * @returns {import('react').ReactElement} La ligne.
 */
function LigneEnConstruction({
  aujourdhui, complexeId, ligne, navigation,
}) {
  const { t } = useTranslation();
  const { Alignments, Colors, Fonts } = useTheme();
  const partager = usePartagerAnnonce();
  const [message, setMessage] = useState('');
  const [refus, setRefus] = useState('');
  const jourJ = ligne.date === aujourdhui;
  const jour = jourJ
    ? t('complexeGerant.construction.aujourdhui', 'Aujourd’hui')
    : titreDuJour(ligne.date);
  const titre = [ligne.terrain?.name, jour, plageHoraire(ligne.from, ligne.to)]
    .filter(Boolean).join(' · ');
  const detail = [
    ligne.label, texteDuCompteur(t, ligne.construction), texteDuManque(t, ligne.construction),
  ].filter(Boolean).join(' · ');
  const ouvrirLaFiche = () => navigation.navigate(RouteNames.ComplexeReservation, {
    complexeId, reservationId: ligne.documentId,
  });
  const partagerLAnnonce = async () => {
    setMessage('');
    setRefus('');
    try {
      const reponse = await partager.mutateAsync({ complexeId, reservationId: ligne.documentId });
      setMessage(messageDuPartage(t, reponse));
    } catch (erreur) {
      const repli = t('complexeReservations.fiche.erreurGeste', 'Le geste n’a pas pu être fait.');
      setRefus(messageDeRefusResa(t, erreur, repli));
    }
  };
  return (
    <View style={{ gap: 8 }} testID={`complexe-accueil-construction-${ligne.documentId}`}>
      <TouchableOpacity
        accessibilityRole="button"
        onPress={ouvrirLaFiche}
        style={[Alignments.row, Alignments.alignCenter, { gap: 8, minHeight: 44 }]}
      >
        <Text style={[Fonts.p2Bold, Fonts.neutral00, { flex: 1 }]}>{titre}</Text>
        {jourJ ? (
          <Text
            style={[
              Fonts.p3Bold,
              {
                backgroundColor: withAlpha(Colors.warning500, 0.18),
                borderRadius: 10,
                color: Colors.warning500,
                overflow: 'hidden',
                paddingHorizontal: 8,
                paddingVertical: 2,
              },
            ]}
          >
            {t('complexeGerant.construction.jourJ', 'Jour J')}
          </Text>
        ) : null}
      </TouchableOpacity>
      <Text style={[Fonts.p3, Fonts.neutral200]}>{detail}</Text>
      <JaugeDeConstruction part={partDeLaJauge(ligne.construction)} />
      {message ? <Text style={[Fonts.p3Bold, Fonts.neutral00]}>{message}</Text> : null}
      {refus ? <Text style={[Fonts.p3Bold, { color: Colors.error500 }]}>{refus}</Text> : null}
      <View style={[Alignments.row, Alignments.wrap, { gap: 8 }]}>
        <View style={{ flexBasis: 140, flexGrow: 1 }}>
          <EcrireAuClient
            complexeId={complexeId}
            navigation={navigation}
            reservationId={ligne.documentId}
            size="sm"
            testID={`complexe-accueil-construction-ecrire-${ligne.documentId}`}
            title={t('complexeReservations.fiche.ecrireAuReserveur', 'Écrire au client')}
          />
        </View>
        <View style={{ flexBasis: 140, flexGrow: 1 }}>
          {peutPartagerLAnnonce(ligne) && ligne.annonce ? (
            <Button
              icon="share"
              iconPosition="before"
              isLoading={Boolean(partager.isPending)}
              onPress={partagerLAnnonce}
              size="sm"
              title={t('complexeGerant.construction.partager', 'Partager l’annonce')}
              variant="Secondary"
            />
          ) : (
            <Button
              onPress={ouvrirLaFiche}
              size="sm"
              title={t('complexeGerant.construction.voirFiche', 'Voir la fiche')}
              variant="Secondary"
            />
          )}
        </View>
      </View>
    </View>
  );
}

/**
 * 🏗️ GERANT-CONSTRUCTION (11/11/2026, D50) — LE BLOC « EN CONSTRUCTION » DE L'ACCUEIL DU GÉRANT
 * (maquette gerant-accueil.png) : dès qu'une réservation est en construction dans son complexe, il
 * la voit et peut agir (lui écrire, partager l'annonce, ouvrir la fiche). Sans elle : rien.
 * ponytail: pas de « Accepter » pour un terrain sur demande pendant la construction (la maquette le
 * dessine ; le serveur n'a pas cet état « acceptée, en construction ») ; sortie : un geste serveur.
 * @param {{ aujourdhui: string, carte: object, complexeId: string | null, navigation: any,
 *   titreSection: (libelle: string) => import('react').ReactElement }} props - Le jour, le style
 *   des cartes de l'accueil, le complexe, la navigation et l'intertitre de l'accueil.
 * @returns {import('react').ReactElement | null} Le bloc, ou rien.
 */
function BlocEnConstruction({
  aujourdhui, carte, complexeId, navigation, titreSection,
}) {
  const { t } = useTranslation();
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();
  const liste = useReservationsDuComplexe(complexeId, { vue: 'construction' });
  const lignes = lignesDesPages(liste?.data);
  if (!complexeId || !lignes.length) return null;
  return (
    <View
      style={[
        carte, Spaces.padding[16], { borderColor: withAlpha(Colors.warning500, 0.5), gap: 12 },
      ]}
      testID="complexe-accueil-construction"
    >
      <View style={[Alignments.row, Alignments.alignCenter, { gap: 8 }]}>
        {titreSection(t('complexeGerant.construction.titre', 'En construction').toUpperCase())}
        <Text style={[Fonts.p3Bold, { color: Colors.warning500 }]}>{String(lignes.length)}</Text>
      </View>
      {lignes.map((ligne, rang) => (
        <View
          key={ligne.documentId}
          style={rang ? {
            borderTopColor: withAlpha(Colors.neutral00, 0.12), borderTopWidth: 1, paddingTop: 12,
          } : null}
        >
          <LigneEnConstruction
            aujourdhui={aujourdhui}
            complexeId={complexeId}
            ligne={ligne}
            navigation={navigation}
          />
        </View>
      ))}
      <Text style={[Fonts.p3, Fonts.neutral200]}>
        {t(
          'complexeGerant.construction.regle',
          'Un autre groupe peut réserver ces créneaux tant qu’ils sont en construction.',
        )}
      </Text>
    </View>
  );
}

export default BlocEnConstruction;
