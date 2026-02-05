import React from 'react';
import {
    Image, Text, TouchableOpacity, View,
} from 'react-native';

import useTheme from '@/theme/themeContext';
import { getImageUrl } from '@/utils/imageUrl';

/**
 * MercatoCard component
 * @param {object} props
 * @param {object} props.user
 * @param {Function} [props.onPress]
 * @returns {React.ReactElement}
 */
const MercatoCard = ({ user, onPress }) => {
    const {
        Alignments, Colors, Fonts, Spaces, Images,
    } = useTheme();

    const avatarSource = user.avatar?.url
        ? { uri: getImageUrl(user.avatar.url) }
        : Images.roundAvatar;

    // Data for badges
    const position = user.position || 'Joueur';
    const category = user.category || user.section?.name;

    return (
        <TouchableOpacity
            onPress={() => onPress && onPress(user)}
            style={[
                {
                    backgroundColor: Colors.neutral800,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: Colors.neutral700,
                    // Shadow for depth
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.25,
                    shadowRadius: 3.84,
                    elevation: 5,
                },
                Spaces.padding[16],
                Alignments.row,
                Alignments.alignCenter,
                Spaces.gap[16],
            ]}
        >
            {/* Avatar with Status Border */}
            <View style={{
                padding: 2,
                backgroundColor: Colors.primary500, // Primary border for "Looking for club"
                borderRadius: 32,
            }}>
                <Image
                    source={avatarSource}
                    style={{
                        width: 60,
                        height: 60,
                        borderRadius: 30,
                        backgroundColor: Colors.neutral200,
                    }}
                />
            </View>

            {/* Info Section */}
            <View style={[Alignments.fill, Spaces.gap[8]]}>
                {/* Name */}
                <Text style={[Fonts.h4, { color: Colors.neutral100 }]}>
                    {user.firstname} {user.lastname}
                </Text>

                {/* Badges Row */}
                <View style={[Alignments.row, Spaces.gap[8], { flexWrap: 'wrap' }]}>
                    {/* Position Badge (Priority) - Solid Style */}
                    <View style={{
                        backgroundColor: Colors.primary500,
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 8,
                    }}>
                        <Text style={[Fonts.p3Bold, { color: Colors.neutral900 }]}>
                            {position}
                        </Text>
                    </View>

                    {/* Category Badge (if available) */}
                    {category && (
                        <View style={{
                            backgroundColor: Colors.neutral700,
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                            borderRadius: 8,
                        }}>
                            <Text style={[Fonts.p3Bold, { color: Colors.neutral300 }]}>
                                {category}
                            </Text>
                        </View>
                    )}
                </View>
            </View>

            {/* Action Button - Simple Chevron */}
            <Image
                source={Images.arrowRight}
                style={{
                    width: 20,
                    height: 20,
                    tintColor: Colors.neutral500,
                    resizeMode: 'contain'
                }}
            />
        </TouchableOpacity>
    );
};

export default MercatoCard;
