import babel from 'rollup-plugin-babel';
import nodeResolve from 'rollup-plugin-node-resolve';
import isBuiltinModule from 'is-builtin-module';

const pkg = require('./package.json');

const external = Object.keys(pkg.dependencies);

process.env.BABEL_ENV = 'rollup';

export default {
  input: 'src/index.js',
  output: [{
    file: pkg.main,
    exports: 'default',
    format: 'cjs',
    sourcemap: true,
  }, {
    file: pkg.module,
    format: 'es',
    sourcemap: true,
  }],
  external: id => isBuiltinModule(id) || external.some(m => id.split('/')[0] === m),
  plugins: [
    babel(),
    nodeResolve(),
  ],
};
