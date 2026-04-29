const mongoose = require('mongoose');

/* ── Reusable sub-schema builders ── */
const confidenceString = () => ({
  value:      { type: String, default: '' },
  confidence: { type: String, default: '' },
  source:     { type: String, default: '' },
});

const confidenceArray = () => ({
  value:      { type: [String], default: [] },
  confidence: { type: String, default: '' },
  source:     { type: String, default: '' },
});

const documentSchema = new mongoose.Schema({
  uniqueId: { type: String, required: true, unique: true, index: true },
  fileName: { type: String, required: true },
  fileKey:  { type: String, required: true },

  /* SHA-256 hash of the raw extracted text — used for duplicate detection */
  contentHash: { type: String, default: '', index: true },

  summary: { type: String, default: '' },

  structured_data: {
    petitioner:         confidenceString(),
    respondent:         confidenceString(),
    court:              confidenceString(),
    state:              confidenceString(),
    date:               confidenceString(),
    order_no:           confidenceString(),
    citation:           confidenceString(),
    judges:             confidenceString(),
    petitioner_counsel: confidenceString(),
    respondent_counsel: confidenceString(),
  },

  additional_fields: {
    case_type:              confidenceString(),
    acts_involved:          confidenceString(),
    sections_involved:      confidenceArray(),
    key_issue:              confidenceString(),
    final_decision:         confidenceString(),
    decision_summary:       confidenceString(),
    important_observations: confidenceString(),
    precedents_cited:       confidenceArray(),
    relevant_notifications: confidenceArray(),
    relevant_circulars:     confidenceArray(),
  },

  table: [{ field: String, value: String }],

  isEdited:     { type: Boolean, default: false },
  lastEditedAt: { type: Date,    default: null  },
  isVerified:   { type: Boolean, default: false },
  verifiedAt:   { type: Date,    default: null  },
}, { timestamps: true, collection: 'gst_case_laws' });

/* ── Performance indexes ── */
documentSchema.index({ 'structured_data.petitioner.value': 1 });
documentSchema.index({ 'structured_data.respondent.value': 1 });
documentSchema.index({ 'structured_data.court.value':      1 });
documentSchema.index({ 'structured_data.state.value':      1 });
documentSchema.index({ 'structured_data.date.value':       1 });
documentSchema.index({ 'structured_data.judges.value':     1 });
documentSchema.index({ 'additional_fields.sections_involved.value': 1 });
documentSchema.index({ 'additional_fields.final_decision.value':   1 });
documentSchema.index({ 'additional_fields.case_type.value':        1 });
documentSchema.index({ isVerified: 1 });
documentSchema.index({ createdAt: -1 });

/* Compound: common filter combo */
documentSchema.index({
  'structured_data.state.value':             1,
  'additional_fields.final_decision.value':  1,
  'additional_fields.sections_involved.value': 1,
});

module.exports = mongoose.model('GstCaseLaw', documentSchema);
