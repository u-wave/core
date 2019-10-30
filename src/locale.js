import fs from 'fs';
import path from 'path';
import i18next from 'i18next';
import YAML from 'yaml';

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

export const t = i18n.getFixedT('en', 'uwave');
export default i18n;
