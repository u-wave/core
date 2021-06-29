'use strict';

const url = require('url');
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
 * @template {{ offset: number }} TPagination
 * @param {import('../Page')<TItem, TPagination>} page
 * @param {{ baseUrl?: string, included?: toListResponse.IncludedOptions }} options
 */
function toPaginatedResponse(
  page,
  { baseUrl = '', included } = {},
) {
  return Object.assign(toListResponse(page.data, {
    included,
    meta: {
      offset: page.currentPage.offset,
      pageSize: page.pageSize,
      results: page.filteredSize,
      total: page.totalSize,
    },
  }), {
    links: {
      self: appendQuery(baseUrl, { page: page.currentPage }),
      next: appendQuery(baseUrl, { page: page.nextPage }),
      prev: appendQuery(baseUrl, { page: page.prevPage }),
    },
  });
}

module.exports = toPaginatedResponse;
