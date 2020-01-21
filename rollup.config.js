import babel from 'rollup-plugin-babel';
import nodeResolve from '@rollup/plugin-node-resolve';
import esModuleInterop from 'rollup-plugin-es-module-interop';
import isBuiltinModule from 'is-builtin-module';

const pkg = require('./package.json');

const external = Object.keys(pkg.dependencies);

function getPackageBasename(id) {
  return id[0] === '@'
    ? id.split('/').slice(0, 2).join('/')
    : id.split('/')[0];
}

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
  external: (id) => isBuiltinModule(id) || external.some((m) => getPackageBasename(id) === m),
  plugins: [
    babel(),
    esModuleInterop(),
    nodeResolve(),
  ],
};
