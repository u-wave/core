module.exports = {
  extends: 'airbnb-base',
  parser: 'babel-eslint',

  rules: {
    'no-underscore-dangle': ['error', { allow: ['_id'] }],
    'no-param-reassign': ['error', { props: false }],
  },
};
