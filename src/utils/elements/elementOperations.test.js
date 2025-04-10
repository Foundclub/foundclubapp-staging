import { ScrollView, Text, View } from 'react-native';

import {
  addBackgroundOnDeepTextChildren,
  capitalizedValue,
} from '@/utils/elements/elementOperations';

describe('addBackgroundOnDeepTextChildren', () => {
  it('should add background color to each element except View ones', () => {
    const children = [
      <Text>Text 1</Text>,
      <View>
        <Text>Text 2</Text>
      </View>,
      <Text>Text 3</Text>,
      <ScrollView>
        <Text>Text 4</Text>
      </ScrollView>,
    ];

    const editedChildren = addBackgroundOnDeepTextChildren(children);

    expect(editedChildren).toMatchInlineSnapshot(`
      [
        {
          "$$typeof": Symbol(react.transitional.element),
          "_owner": null,
          "_store": {},
          "key": ".0",
          "props": {
            "children": [
              "Text 1",
            ],
            "style": [
              {
                "backgroundColor": "white",
              },
            ],
          },
          "type": [Function],
        },
        {
          "$$typeof": Symbol(react.transitional.element),
          "_owner": null,
          "_store": {},
          "key": ".1",
          "props": {
            "children": [
              {
                "$$typeof": Symbol(react.transitional.element),
                "_owner": null,
                "_store": {},
                "key": ".0",
                "props": {
                  "children": [
                    "Text 2",
                  ],
                  "style": [
                    {
                      "backgroundColor": "white",
                    },
                  ],
                },
                "type": [Function],
              },
            ],
            "style": [],
          },
          "type": [Function],
        },
        {
          "$$typeof": Symbol(react.transitional.element),
          "_owner": null,
          "_store": {},
          "key": ".2",
          "props": {
            "children": [
              "Text 3",
            ],
            "style": [
              {
                "backgroundColor": "white",
              },
            ],
          },
          "type": [Function],
        },
        {
          "$$typeof": Symbol(react.transitional.element),
          "_owner": null,
          "_store": {},
          "key": ".3",
          "props": {
            "children": [
              {
                "$$typeof": Symbol(react.transitional.element),
                "_owner": null,
                "_store": {},
                "key": ".0",
                "props": {
                  "children": [
                    "Text 4",
                  ],
                  "style": [
                    {
                      "backgroundColor": "white",
                    },
                  ],
                },
                "type": [Function],
              },
            ],
            "style": [],
          },
          "type": [Function],
        },
      ]
    `);
  });

  it('should return null if childrenToEdit is null', () => {
    const children = null;

    const editedChildren = addBackgroundOnDeepTextChildren(children);

    expect(editedChildren).toBeNull();
  });

  it('should return an empty array if childrenToEdit is an empty array', () => {
    const children = [];

    const editedChildren = addBackgroundOnDeepTextChildren(children);

    expect(editedChildren).toEqual([]);
  });
});

describe('capitalizedValue', () => {
  it('should capitalize the first letter of a string', () => {
    const value = 'hello';
    const result = capitalizedValue(value);
    expect(result).toBe('Hello');
  });

  it('should return an empty string if value is empty', () => {
    const value = '';
    const result = capitalizedValue(value);
    expect(result).toBe('');
  });

  it('should return an empty string if value is undefined', () => {
    const result = capitalizedValue(undefined);
    expect(result).toBe('');
  });
});
