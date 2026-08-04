// app/core/b2b/index.server.js
// Barrel re-exports for the b2b domain (backward-compatible public API).

export {
  COMPANY_MEMBER_ROLES,
  DEFAULT_COMPANY_LIST_LIMIT,
  MAX_COMPANY_LIST_RESULTS,
  parseCompanyListParams,
  buildCompanyWhere,
  parseCreateCompanyInput,
  parseAddCompanyMemberInput,
  parseCreateCompanyForm,
  parseAddCompanyMemberForm,
  serializeCompany,
  listCompanies,
  getCompany,
  createCompany,
  addCompanyMember,
  listCustomersForCompanyForm,
  loadCompanyAdminIndexData,
} from '#/core/b2b/companies.server';

export {
  QUOTE_STATUSES,
  DEFAULT_QUOTE_LIST_LIMIT,
  MAX_QUOTE_LIST_RESULTS,
  parseQuoteListParams,
  buildQuoteWhere,
  parseQuoteLinesInput,
  parseCreateQuoteInput,
  parseCreateQuoteForm,
  parseUpdateQuoteStatusInput,
  formatQuoteMoney,
  serializeQuoteLine,
  serializeQuote,
  listQuotes,
  getQuote,
  createQuote,
  updateQuoteStatus,
  sendQuote,
  acceptQuote,
  listVariantsForQuoteForm,
  loadQuoteAdminIndexData,
} from '#/core/b2b/quotes.server';
