'use strict';

const fs = require('fs');
const path = require('path');
const i18next = require('i18next');
const YAML = require('yaml');

const source = fs.readFileSync(path.join(__dirname, '../locale/en.yaml'), 'utf8');
const en = YAML.parse(source);

const i18n = i18next.createInstance();
i18n.init({
  fallbackLng: 'en',
  lng: 'en',
  defaultNS: 'uwave',
  interpolation: {
    escapeValue: false,
  },
});

i18n.addResourceBundle('en', 'uwave', en.uwave);

exports.t = i18n.getFixedT('en', 'uwave');
exports.i18n = i18n;
