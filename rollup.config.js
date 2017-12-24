import babel from 'rollup-plugin-babel';
import nodeResolve from 'rollup-plugin-node-resolve';
import isBuiltinModule from 'is-builtin-module';

const { name, dependencies } = require('./package.json');

const external = Object.keys(dependencies);

process.env.BABEL_ENV = 'rollup';

export default {
  input: 'src/index.js',
  output: {
    file: `dist/${name}.js`,
    format: 'cjs',
    sourcemap: true,
  },
  external: id => isBuiltinModule(id) || external.some(m => id.split('/')[0] === m),
  plugins: [
    babel(),
    nodeResolve(),
  ],
};
