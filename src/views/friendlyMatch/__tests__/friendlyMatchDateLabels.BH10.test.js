// BH10 P10-24 : une date convenue COMPLETE (avec heure) se dit en jour LOCAL.
import { toReadableDay } from '../friendlyMatchDateLabels';

test('P10-24 : 00:30 locale le 16 mai se lit « 16 mai », pas « 15 mai »', () => {
  expect(toReadableDay(new Date(2099, 4, 16, 0, 30).toISOString())).toContain('16 mai');
  expect(toReadableDay('2099-05-16')).toContain('16 mai');
});
