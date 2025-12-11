import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import useTheme from '@/theme/themeContext';

const InputStepper = ({ value, onIncrement, onDecrement, min = 0, max = 100, label }) => {
    const { Spaces, Fonts, Colors, Alignments } = useTheme();

    return (
        <View>
            {label && <Text style={[Fonts.p2, Fonts.neutral300, Spaces.marginBottom[8]]}>{label}</Text>}
            <View style={[
                Alignments.row,
                Alignments.alignCenter,
                Alignments.justifySpaceBetween,
                { backgroundColor: Colors.neutral100, borderRadius: 8, padding: 4 }
            ]}>
                <TouchableOpacity
                    onPress={onDecrement}
                    disabled={value <= min}
                    style={[
                        Spaces.padding[12],
                        { backgroundColor: Colors.neutral00, borderRadius: 6 },
                        value <= min && { opacity: 0.5 }
                    ]}
                >
                    <Text style={[Fonts.h3, Fonts.primary500]}>-</Text>
                </TouchableOpacity>

                <Text style={[Fonts.h3, Fonts.neutral900]}>{value}</Text>

                <TouchableOpacity
                    onPress={onIncrement}
                    disabled={value >= max}
                    style={[
                        Spaces.padding[12],
                        { backgroundColor: Colors.neutral00, borderRadius: 6 },
                        value >= max && { opacity: 0.5 }
                    ]}
                >
                    <Text style={[Fonts.h3, Fonts.primary500]}>+</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

import PropTypes from 'prop-types';

InputStepper.propTypes = {
    value: PropTypes.number.isRequired,
    onIncrement: PropTypes.func.isRequired,
    onDecrement: PropTypes.func.isRequired,
    min: PropTypes.number,
    max: PropTypes.number,
    label: PropTypes.string,
};

export default InputStepper;
