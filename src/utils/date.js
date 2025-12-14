// A minimal set of date-fns-style functions used by üWave.
// Inspiration: https://date-fns.org/

export const MS_PER_SECOND = 1_000;
export const MS_PER_MINUTE = MS_PER_SECOND * 60;
export const MS_PER_HOUR = MS_PER_MINUTE * 60;
export const MS_PER_DAY = MS_PER_HOUR * 24;
export const MS_PER_WEEK = MS_PER_DAY * 7;

/**
 * @param {Date} date
 * @param {Date} dateToCompare
 */
export function isBefore(date, dateToCompare) {
  return +date < +dateToCompare;
}

/**
 * @param {Date} date
 * @param {number} millis
 */
export function addMilliseconds(date, millis) {
  return new Date(+date + millis);
}

/**
 * @param {Date} date
 * @param {number} minutes
 */
export function subMinutes(date, minutes) {
  return new Date(+date - minutes * MS_PER_MINUTE);
}

/**
 * @param {Date} date
 * @param {number} hours
 */
export function addHours(date, hours) {
  return new Date(+date + hours * MS_PER_HOUR);
}

/**
 * @param {Date} date
 * @param {number} hours
 */
export function subHours(date, hours) {
  return new Date(+date - hours * MS_PER_HOUR);
}
