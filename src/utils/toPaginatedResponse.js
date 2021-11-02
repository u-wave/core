'use strict';

const url = require('url');
const has = require('has');
const qs = require('qs');
const toListResponse = require('./toListResponse');

/**
 * @param {string} base
 * @param {object} query
 * @returns {string}
 */
function appendQuery(base, query) {
  // eslint-disable-next-line node/no-deprecated-api
  const parsed = url.parse(base, true);
  parsed.search = qs.stringify({
    ...parsed.query,
    ...query,
  });
  parsed.query = {};
  return `${url.format(parsed)}`;
}

/**
 * @template {any} TItem
 * @template {import('type-fest').JsonValue} TPagination
 * @param {import('../Page')<TItem, TPagination>} page
 * @param {{ baseUrl?: string, included?: toListResponse.IncludedOptions }} options
 */
function toPaginatedResponse(
  page,
  { baseUrl = '', included } = {},
) {
  /** @type {import('type-fest').JsonObject} */
  const meta = {
    pageSize: page.pageSize,
    results: page.filteredSize,
    total: page.totalSize,
  };

  if (page.currentPage
      && typeof page.currentPage === 'object'
      && has(page.currentPage, 'offset')
      && typeof page.currentPage.offset === 'number') {
    meta.offset = page.currentPage.offset;
  }

  return Object.assign(toListResponse(page.data, {
    included,
    meta,
  }), {
    links: {
      self: appendQuery(baseUrl, { page: page.currentPage }),
      next: appendQuery(baseUrl, { page: page.nextPage }),
      prev: appendQuery(baseUrl, { page: page.prevPage }),
    },
  });
}

module.exports = toPaginatedResponse;
