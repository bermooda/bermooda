// app/core/marketing/index.server.js
// Barrel re-exports for the marketing domain (backward-compatible public API).

export {
  parseSegmentRules,
  parseSegmentRulesInput,
  parseSegmentRulesFromForm,
  parseCreateSegmentInput,
  parseUpdateSegmentInput,
  listSegments,
  getSegment,
  createSegment,
  updateSegment,
  deleteSegment,
  customerMatchesSegment,
  resolveSegmentCustomers,
} from '#/core/marketing/segments.server';

export {
  parseCreateCampaignInput,
  listCampaigns,
  getCampaign,
  createCampaign,
  sendCampaign,
} from '#/core/marketing/campaigns.server';

export {
  DEFAULT_ABANDONED_CART_SEQUENCES,
  parseCreateAbandonedCartSequenceInput,
  parseUpdateAbandonedCartSequenceInput,
  listAbandonedCartSequences,
  getAbandonedCartSequence,
  createAbandonedCartSequence,
  updateAbandonedCartSequence,
  processAbandonedCarts,
  seedDefaultAbandonedCartSequences,
} from '#/core/marketing/abandoned-cart.server';
