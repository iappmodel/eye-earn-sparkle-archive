/**
 * Dev-gated logger. Debug/info/warn logs are suppressed in production.
 * Use for [RemoteControl], [MediaCard], [Rewards], etc. to avoid console noise.
 */
const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV === true;

function noop() {}

export const logger = {
  debug: isDev ? console.debug.bind(console) : noop,
  log: isDev ? console.log.bind(console) : noop,
  info: isDev ? console.info.bind(console) : noop,
  warn: isDev ? console.warn.bind(console) : noop,
  /** Errors always log (helps production debugging). Use for genuine failures. */
  error: console.error.bind(console),
};
