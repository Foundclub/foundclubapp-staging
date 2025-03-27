import { lightenColor } from './colorsOperations';

describe('lightenColor', () => {
  it('should lighten the color by the specified amount', () => {
    const color = '#FF0000';
    const amount = 0.2;
    const expectedColor = '#FF3333';

    const result = lightenColor(color, amount);

    expect(result).toBe(expectedColor);
  });

  it('should return the same color if the amount is 0', () => {
    const color = '#00FF00';
    const amount = 0;
    const expectedColor = '#00FF00';

    const result = lightenColor(color, amount);

    expect(result).toBe(expectedColor);
  });

  it('should return a lighter color if the amount is greater than 0', () => {
    const color = '#0000FF';
    const amount = 0.5;
    const expectedColor = '#8080FF';

    const result = lightenColor(color, amount);

    expect(result).toBe(expectedColor);
  });
});
