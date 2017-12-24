import babel from 'rollup-plugin-babel';
import nodeResolve from 'rollup-plugin-node-resolve';
import isBuiltinModule from 'is-builtin-module';

const external = Object.keys(require('./package.json').dependencies);

process.env.BABEL_ENV = 'rollup';

export default {
  input: 'src/index.js',
  output: {
    file: 'dist/u-wave-core.js',
    format: 'cjs',
  },
  external: id => isBuiltinModule(id) || external.some(m => id.split('/')[0] === m),
  plugins: [
    babel(),
    nodeResolve(),
  ],
};
