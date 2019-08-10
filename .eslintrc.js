module.exports = {
  extends: 'airbnb-base',
  parser: 'babel-eslint',

  rules: {
    // MongoDB IDs
    'no-underscore-dangle': ['error', { allow: ['_id'] }],
    // Used by plugins
    'no-param-reassign': ['error', { props: false }],
    // I disagree that this is bad
    'max-classes-per-file': 'off',
  },
};
