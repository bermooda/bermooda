// litefs-js should be used server-side only. It imports `fs` which results in the
// client bundle including a large polyfill. Keep imports in a `.server.js` module.
// https://github.com/epicweb-dev/epic-stack/pull/331
export {
  getInstanceInfo,
  getInstanceInfoSync,
  TXID_NUM_COOKIE_NAME,
  waitForUpToDateTxNumber,
  getTxNumber,
  getTxSetCookieHeader,
  checkCookieForTransactionalConsistency,
  getInternalInstanceDomain,
  getAllInstances,
} from 'litefs-js';

export {
  ensurePrimary,
  ensureInstance,
  getReplayResponse,
  handleTransactionalConsistency,
  appendTxNumberCookie,
} from 'litefs-js/remix';
