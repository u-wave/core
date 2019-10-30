import {
  isPlainObject,
  cloneDeep,
  get as getPath,
  set as setPath,
} from 'lodash';

function extractIncluded(data, included) {
  const includedTypes = Object.keys(included);
  if (includedTypes.length === 0) {
    return {
      data,
      included: {},
    };
  }

  const includeds = includedTypes.reduce(
    (map, typeName) => Object.assign(map, { [typeName]: [] }),
    {},
  );

  const had = {};

  const resultData = [];
  data.forEach((initialItem) => {
    let item = isPlainObject(initialItem) ? initialItem : initialItem.toJSON();
    includedTypes.forEach((type) => {
      included[type].forEach((path) => {
        const includedItem = getPath(item, path);
        if (includedItem) {
          if (item === initialItem) {
            item = cloneDeep(item);
          }
          setPath(item, path, includedItem._id);
          if (!had[type + includedItem._id]) {
            includeds[type].push(includedItem);
            had[type + includedItem._id] = true;
          }
        }
      });
    });
    resultData.push(item);
  });

  return {
    included: includeds,
    data: resultData,
  };
}

export default function toListResponse(list, {
  meta = {},
  included = {},
  url = null,
} = {}) {
  let props = { data: list };
  if (included) {
    props = extractIncluded(list, included);
  }
  return {
    meta: {
      included,
      ...meta,
    },
    links: url ? { self: url } : {},
    data: null,
    included: null,
    ...props,
  };
}
