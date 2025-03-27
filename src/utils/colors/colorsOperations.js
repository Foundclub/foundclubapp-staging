/**
 * lighten a color by a specified amount
 * @param {string} color - The color to lighten
 * @param {number} amount - The amount to lighten the color
 * @returns {string} The lightened color
 */
export const lightenColor = (color, amount) => {
  // Parse the color string to get the RGB values
  const hex = color.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Adjust the RGB values based on the amount
  const adjustedR = Math.round(r + (255 - r) * amount);
  const adjustedG = Math.round(g + (255 - g) * amount);
  const adjustedB = Math.round(b + (255 - b) * amount);

  // Convert the adjusted RGB values back to hexadecimal
  const adjustedHex = `#${adjustedR.toString(16).padStart(2, '0')}${adjustedG
    .toString(16)
    .padStart(2, '0')}${adjustedB.toString(16).padStart(2, '0')}`;
  return adjustedHex?.toUpperCase();
};
