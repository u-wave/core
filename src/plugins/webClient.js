'use strict';

const astring = require('astring');
const schema = require('../schemas/webClient.json');
const toItemResponse = require('../utils/toItemResponse');

function recmaBundle() {
  return (tree) => {
    tree.body = tree.body.map((node) => {
      if (node.type === 'ImportDeclaration') {
        if (node.source.type === 'Literal' && node.source.value === 'react/jsx-runtime') {
          return null;
        }
      }
      if (node.type === 'ExportNamedDeclaration') {
        return node.declaration;
      }
      if (node.type === 'ExportDefaultDeclaration') {
        return {
          type: 'VariableDeclaration',
          kind: 'var',
          declarations: [{
            type: 'VariableDeclarator',
            id: {
              type: 'Identifier',
              name: '$$aboutPageMain',
            },
            init: node.declaration,
          }],
        };
      }
      return node;
    }).filter(Boolean);

    return tree;
  };
}

function recmaMinifiedStringify() {
  function compiler(tree) {
    return astring.generate(tree, {
      indent: '',
      lineEnd: '',
    });
  }

  this.Compiler = compiler;
}

async function compileAboutPage(config) {
  if (typeof config.about !== 'string') {
    return null;
  }

  const xdm = await import('xdm');
  const { contents } = await xdm.compile(config.about, {
    recmaPlugins: [recmaBundle, recmaMinifiedStringify],
  });

  return contents;
}

async function webClientPlugin(uw) {
  uw.config.register(schema['uw:key'], schema);

  let currentConfig;
  let aboutPage;

  async function refresh() {
    currentConfig = await uw.config.get(schema['uw:key']);
    aboutPage = compileAboutPage(currentConfig);
  }

  await refresh();

  uw.config.on('set', (key) => {
    if (key === schema['uw:key']) {
      refresh().catch((error) => {
        console.error(error.stack);
      });
    }
  });

  uw.httpApi.use('/web-client/config.json', (req, res, next) => {
    aboutPage.then((result) => {
      res.json(toItemResponse({
        ...currentConfig,
        aboutPage: result,
      }));
    }, (error) => {
      next(error);
    });
  });
}

module.exports = webClientPlugin;
