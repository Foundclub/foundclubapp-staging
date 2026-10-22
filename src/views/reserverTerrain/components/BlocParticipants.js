import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import { participantsDeLOnglet } from '@/domains/complexe/partieDuJoueur';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import PuceChoix from '@/views/reserverTerrain/components/PuceChoix';

const REPLIES_AU_DELA = 6;
const AVATAR = 36;

/**
 * Les initiales d'un « Julien M. » : « JM ».
 * @param {unknown} libelle - Prénom + initiale.
 * @returns {string} Deux lettres au plus.
 */
const initiales = (libelle) => String(libelle || '')
  .replace(/\./g, '')
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map((mot) => mot.charAt(0).toLocaleUpperCase())
  .join('');

/**
 * « PARTICIPANTS · 8/10 » — RESA-L6B-2 (20/10/2026), planche EP07 états 1 à 3, plan E-P07 bloc 3
 * (A-P06, RC-T04 : prénom et initiale seulement, jamais un téléphone). Les onglets Tous · Présents
 * · Absents · Sans réponse (comptés par le serveur), une rangée-pilule par participant avec sa
 * pastille, « (toi) » pour soi ; repliés au-delà de 6 (« Voir les 10 »).
 * @param {object} props - Les propriétés.
 * @param {{ counts?: { absents?: number, presents?: number, sansReponse?: number },
 *   participants?: any[], places?: number } | null} props.groupe - Le groupe.
 * @returns {import('react').ReactElement | null} Le bloc, ou rien sans groupe.
 */
function BlocParticipants({ groupe }) {
  const { t } = useTranslation();
  const { Alignments, Colors, Fonts } = useTheme();
  const [onglet, setOnglet] = useState('tous');
  const [deplies, setDeplies] = useState(false);
  if (!groupe) return null;

  const counts = groupe.counts || {};
  const tous = Array.isArray(groupe.participants) ? groupe.participants : [];
  const onglets = [
    { cle: 'tous', libelle: t('reserverTerrain.participants.tous', 'Tous') },
    {
      cle: 'presents',
      libelle: t('reserverTerrain.participants.presents', 'Présents {{nombre}}', {
        nombre: Number(counts.presents) || 0,
      }),
    },
    {
      cle: 'absents',
      libelle: t('reserverTerrain.participants.absents', 'Absents {{nombre}}', {
        nombre: Number(counts.absents) || 0,
      }),
    },
    {
      cle: 'sansReponse',
      libelle: t('reserverTerrain.participants.sansReponse', 'Sans réponse {{nombre}}', {
        nombre: Number(counts.sansReponse) || 0,
      }),
    },
  ];
  const liste = participantsDeLOnglet(tous, onglet);
  const visibles = deplies ? liste : liste.slice(0, REPLIES_AU_DELA);

  /** @type {Record<string, { couleur: string, mot: string, pointillee?: boolean }>} */
  const reponses = {
    absent: {
      couleur: Colors.error500,
      mot: t('reserverTerrain.participants.absent', 'Absent'),
    },
    present: {
      couleur: Colors.success500,
      mot: t('reserverTerrain.participants.present', 'Présent'),
    },
    sans_reponse: {
      couleur: Colors.primary200,
      mot: t('reserverTerrain.participants.pasRepondu', 'Pas répondu'),
      pointillee: true,
    },
  };

  return (
    <View style={{ gap: 12 }} testID="ma-reservation-participants">
      <Text accessibilityRole="header" style={[Fonts.h4Bold, Fonts.neutral00]}>
        {t('reserverTerrain.participants.titre', 'Participants · {{presents}}/{{places}}', {
          places: Number(groupe.places) || 0,
          presents: Number(counts.presents) || 0,
        })}
      </Text>
      <View style={[Alignments.row, Alignments.wrap, { gap: 8 }]}>
        {onglets.map(({ cle, libelle }) => (
          <PuceChoix
            choisie={onglet === cle}
            key={cle}
            libelle={libelle}
            onPress={() => {
              setOnglet(cle);
              setDeplies(false);
            }}
          />
        ))}
      </View>
      {visibles.map((participant, rang) => {
        const reponse = reponses[participant?.response] || reponses.sans_reponse;
        const nom = participant?.isMe
          ? t('reserverTerrain.participants.toi', '{{nom}} (toi)', {
            nom: String(participant?.label || ''),
            ...SANS_ECHAPPEMENT,
          })
          : String(participant?.label || '');
        return (
          <View
            // eslint-disable-next-line react/no-array-index-key -- un « Julien M. » peut revenir.
            key={`${participant?.label}-${rang}`}
            style={[
              Alignments.row,
              Alignments.alignCenter,
              {
                backgroundColor: withAlpha(Colors.primary800, 0.6),
                borderColor: withAlpha(Colors.primary500, 0.24),
                borderRadius: 999,
                borderWidth: 1,
                gap: 10,
                minHeight: 48,
                paddingHorizontal: 6,
                paddingVertical: 6,
              },
            ]}
          >
            <View
              style={[
                Alignments.alignCenter,
                Alignments.justifyCenter,
                {
                  backgroundColor: withAlpha(Colors.primary500, 0.2),
                  borderRadius: AVATAR / 2,
                  height: AVATAR,
                  width: AVATAR,
                },
              ]}
            >
              <Text style={[Fonts.p3Bold, Fonts.primary200]}>{initiales(participant?.label)}</Text>
            </View>
            <Text style={[Fonts.p2Bold, Fonts.neutral00, { flex: 1 }]}>{nom}</Text>
            <View
              style={{
                backgroundColor: reponse.pointillee
                  ? 'transparent'
                  : withAlpha(reponse.couleur, 0.14),
                borderColor: withAlpha(reponse.couleur, 0.6),
                borderRadius: 999,
                borderStyle: reponse.pointillee ? 'dashed' : 'solid',
                borderWidth: 1,
                marginRight: 6,
                paddingHorizontal: 8,
                paddingVertical: 2,
              }}
            >
              <Text style={[Fonts.p3Bold, { color: reponse.couleur }]}>{reponse.mot}</Text>
            </View>
          </View>
        );
      })}
      {!deplies && liste.length > REPLIES_AU_DELA ? (
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => setDeplies(true)}
          style={{ alignItems: 'center', justifyContent: 'center', minHeight: 44 }}
        >
          <Text style={[Fonts.p2Bold, Fonts.primary500]}>
            {t('reserverTerrain.participants.voirTous', 'Voir les {{nombre}}', {
              nombre: liste.length,
            })}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export default BlocParticipants;
