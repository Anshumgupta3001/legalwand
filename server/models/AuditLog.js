const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'GstCaseLaw', required: true, index: true },
  userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action:     { type: String, enum: ['edit', 'verify', 'unverify', 'bulk_verify', 'bulk_edit'], required: true },
  field:      { type: String, default: '' },      /* which field changed */
  oldValue:   { type: mongoose.Schema.Types.Mixed },
  newValue:   { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true, collection: 'audit_logs' });

auditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
