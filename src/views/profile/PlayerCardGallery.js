// @ts-nocheck
/**
 * PlayerCardGallery — galerie DEV de revue du design de la carte collectible.
 * Non routee en production : brancher temporairement (ou via un ecran dev)
 * pour verifier les 5 raretes et les 2 panneaux bas.
 */
import {
  StyleSheet, Text, useWindowDimensions, View,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';

import PlayerCard from '@/components/organisms/playerCard/PlayerCard';
import ScreenContainer from '@/components/templates/ScreenContainer';

const RARITIES = ['MOST_RARE', 'ULTRA_RARE', 'EPIC', 'RARE', 'COMMON'];

const BASE_PROPS = {
  age: '24 ANS',
  club: 'FC BELLEVILLE',
  disposition: '4-2-3-1',
  historique: [
    { categorie: 'RÉGIONAL', club: 'FC Belleville', periode: '2023–AUJ.' },
    { categorie: 'DÉPARTEMENTAL', club: 'AS Bagnolet', periode: '2019–2023' },
    { categorie: 'U19', club: 'ES Pantin', periode: '2016–2019' },
  ],
  nationalite: 'FRA',
  nom: 'Martin',
  numero: '10',
  poste: 'MOC',
  posteIndex: 7,
  prenom: 'Léo',
  qrValue: 'https://foundclub.app/install.html?type=player&id=demo&source=card',
  sport: 'FOOTBALL',
  statut: 'DISPONIBLE',
  ville: 'Marseille',
};

/** Rend une carte de demo (enumeration explicite : prop spreading interdit). */
const renderDemoCard = (props) => (
  <PlayerCard
    age={props.age}
    bottomPanel={props.bottomPanel}
    club={props.club}
    disposition={props.disposition}
    historique={props.historique}
    nationalite={props.nationalite}
    nom={props.nom}
    numero={props.numero}
    photo={props.photo}
    poste={props.poste}
    posteIndex={props.posteIndex}
    prenom={props.prenom}
    qrValue={props.qrValue}
    rarity={props.rarity}
    sport={props.sport}
    statut={props.statut}
    ville={props.ville}
    width={props.width}
  />
);

/** Galerie de revue design : 5 raretes + variantes de panneau bas. */
function PlayerCardGallery() {
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(width - 64, 520);

  return (
    <ScreenContainer bgImage="bg2">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {RARITIES.map((rarity) => (
          <View key={rarity} style={styles.slot}>
            <Text style={styles.label}>{`${rarity} · HISTORIQUE`}</Text>
            {renderDemoCard({
              ...BASE_PROPS, bottomPanel: 'historique', rarity, width: cardWidth,
            })}
          </View>
        ))}
        <View style={styles.slot}>
          <Text style={styles.label}>MOST_RARE · TACTIQUE</Text>
          {renderDemoCard({
            ...BASE_PROPS, bottomPanel: 'tactique', rarity: 'MOST_RARE', width: cardWidth,
          })}
        </View>
        <View style={styles.slot}>
          <Text style={styles.label}>COMMON · TACTIQUE · INDISPONIBLE · SANS PHOTO</Text>
          {renderDemoCard({
            ...BASE_PROPS,
            bottomPanel: 'tactique',
            club: 'SANS CLUB',
            rarity: 'COMMON',
            statut: 'INDISPONIBLE',
            width: cardWidth,
          })}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: 'center', gap: 48, paddingVertical: 48 },
  label: {
    color: '#8fb2c2', fontFamily: 'Montserrat-Bold', fontSize: 13, letterSpacing: 1.5, marginBottom: 14, textAlign: 'center',
  },
  slot: { alignItems: 'center' },
});

export default PlayerCardGallery;
