import {
  getPlaceholderDataOption,
  keepPreviousPageData,
} from './queryOptions';

describe('queryOptions', () => {
  test('keeps previous page data by default', () => {
    expect(getPlaceholderDataOption({})).toBe(keepPreviousPageData);
    expect(keepPreviousPageData({ pages: ['old'] })).toEqual({ pages: ['old'] });
  });

  test('allows screens to disable placeholder data explicitly', () => {
    expect(getPlaceholderDataOption({ placeholderData: undefined })).toBeUndefined();
  });
});
