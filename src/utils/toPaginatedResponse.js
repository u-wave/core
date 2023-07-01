import qs from 'qs';
import toListResponse from './toListResponse.js';

/**
 * @param {string} base
 * @param {object} query
 * @returns {string}
 */
function appendQuery(base, query) {
  const parsed = new URL(base);
  parsed.search = qs.stringify({
    ...qs.parse(parsed.search),
    ...query,
  });
  return parsed.toString();
}

/**
 * @template {any} TItem
 * @template {{ offset: number }} TPagination
 * @param {import('../Page.js').default<TItem, TPagination>} page
 * @param {{ baseUrl?: string, included?: import('./toListResponse.js').IncludedOptions }} options
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
      results: page.filteredSize ?? null,
      total: page.totalSize ?? null,
    },
  }), {
    links: {
      self: appendQuery(baseUrl, { page: page.currentPage }),
      next: appendQuery(baseUrl, { page: page.nextPage }),
      prev: appendQuery(baseUrl, { page: page.prevPage }),
    },
  });
}

export default toPaginatedResponse;
