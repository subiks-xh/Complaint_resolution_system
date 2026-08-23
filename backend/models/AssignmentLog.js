const mongoose = require('mongoose');

const assignmentLogSchema = new mongoose.Schema({
  complaint: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Complaint',
    required: true
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Assignment Details
  assignmentType: {
    type: String,
    enum: ['immediate', 'scheduled', 'queue', 'auto', 'manual', 'escalated'],
    default: 'manual'
  },
  assignmentMethod: {
    type: String,
    enum: ['round_robin', 'least_loaded', 'skill_based', 'geographic', 'performance_based', 'manual'],
    default: 'manual'
  },
  
  // Configuration Used
  configuration: {
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      required: true
    },
    dueDate: Date,
    slaOverride: { type: Boolean, default: false },
    customSLA: Number, // hours
    scheduledTime: Date,
    assignmentNotes: String,
    notificationSettings: {
      notifyAssignee: { type: Boolean, default: true },
      notifyUser: { type: Boolean, default: false },
      notifySupervisor: { type: Boolean, default: false }
    },
    escalationEnabled: { type: Boolean, default: true }
  },
  
  // Context Information
  context: {
    staffWorkloadBefore: Number,
    staffWorkloadAfter: Number,
    totalAvailableStaff: Number,
    ruleUsed: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AssignmentRule'
    },
    fallbackReason: String, // If assignment rule failed
    geographic: {
      distance: Number, // km
      location: {
        type: { type: String, enum: ['Point'] },
        coordinates: [Number] // [longitude, latitude]
      }
    }
  },
  
  // Timing Information
  timing: {
    assignmentProcessedAt: { type: Date, default: Date.now },
    assignmentCompletedAt: Date,
    timeToAssign: Number, // milliseconds
    scheduledFor: Date,
    actualAssignmentTime: Date
  },
  
  // Status Tracking
  status: {
    type: String,
    enum: ['pending', 'assigned', 'accepted', 'rejected', 'cancelled', 'escalated'],
    default: 'assigned'
  },
  
  // Staff Response
  staffResponse: {
    respondedAt: Date,
    response: {
      type: String,
      enum: ['accepted', 'rejected', 'delegated']
    },
    rejectionReason: String,
    delegatedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    estimatedCompletionTime: Date
  },
  
  // Performance Metrics
  metrics: {
    responseTime: Number, // seconds from assignment to acceptance
    isWithinSLA: Boolean,
    slaBreachTime: Number, // seconds of SLA breach
    customerSatisfactionImpact: Number, // 1-5 scale
    reassignmentCount: { type: Number, default: 0 },
    escalationTriggered: { type: Boolean, default: false }
  },
  
  // Audit Trail
  history: [{
    action: {
      type: String,
      enum: ['assigned', 'accepted', 'rejected', 'reassigned', 'escalated', 'completed', 'cancelled']
    },
    timestamp: { type: Date, default: Date.now },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reason: String,
    previousAssignee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization'
  }
}, {
  timestamps: true
});

// Indexes
assignmentLogSchema.index({ complaint: 1 });
assignmentLogSchema.index({ assignedTo: 1, status: 1 });
assignmentLogSchema.index({ organization: 1, createdAt: -1 });
assignmentLogSchema.index({ 'timing.assignmentProcessedAt': -1 });
assignmentLogSchema.index({ status: 1, 'configuration.dueDate': 1 });

// Compound indexes for analytics
assignmentLogSchema.index({ 
  organization: 1, 
  assignmentMethod: 1, 
  'timing.assignmentProcessedAt': -1 
});
assignmentLogSchema.index({ 
  assignedTo: 1, 
  'timing.assignmentProcessedAt': -1,
  status: 1 
});

// Virtual for calculating assignment efficiency
assignmentLogSchema.virtual('efficiency').get(function() {
  if (!this.staffResponse.respondedAt || !this.timing.assignmentProcessedAt) {
    return null;
  }
  
  const responseTime = this.staffResponse.respondedAt - this.timing.assignmentProcessedAt;
  const maxExpectedResponse = 4 * 60 * 60 * 1000; // 4 hours in milliseconds
  
  return Math.max(0, Math.min(100, 100 - (responseTime / maxExpectedResponse * 100)));
});

// Methods
assignmentLogSchema.methods.updateStatus = function(newStatus, performedBy, reason) {
  this.status = newStatus;
  this.history.push({
    action: newStatus,
    timestamp: new Date(),
    performedBy,
    reason
  });
  
  if (newStatus === 'accepted') {
    this.staffResponse.respondedAt = new Date();
    this.staffResponse.response = 'accepted';
    this.metrics.responseTime = (new Date() - this.timing.assignmentProcessedAt) / 1000;
  } else if (newStatus === 'rejected') {
    this.staffResponse.respondedAt = new Date();
    this.staffResponse.response = 'rejected';
    this.staffResponse.rejectionReason = reason;
  }
  
  return this.save();
};

assignmentLogSchema.methods.checkSLA = function(slaHours = 24) {
  if (!this.timing.assignmentProcessedAt) return false;
  
  const now = new Date();
  const slaDeadline = new Date(this.timing.assignmentProcessedAt.getTime() + (slaHours * 60 * 60 * 1000));
  
  this.metrics.isWithinSLA = now <= slaDeadline;
  if (!this.metrics.isWithinSLA) {
    this.metrics.slaBreachTime = (now - slaDeadline) / 1000;
  }
  
  return this.metrics.isWithinSLA;
};

// Static methods for analytics
assignmentLogSchema.statics.getAssignmentAnalytics = async function(organizationId, dateRange = {}) {
  const { startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), endDate = new Date() } = dateRange;
  
  const pipeline = [
    {
      $match: {
        organization: new mongoose.Types.ObjectId(organizationId),
        'timing.assignmentProcessedAt': { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: '$assignmentMethod',
        totalAssignments: { $sum: 1 },
        avgResponseTime: { $avg: '$metrics.responseTime' },
        slaCompliance: {
          $avg: {
            $cond: [{ $eq: ['$metrics.isWithinSLA', true] }, 1, 0]
          }
        },
        rejectionRate: {
          $avg: {
            $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0]
          }
        }
      }
    }
  ];
  
  return await this.aggregate(pipeline);
};

assignmentLogSchema.statics.getStaffPerformanceMetrics = async function(staffId, dateRange = {}) {
  const { startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), endDate = new Date() } = dateRange;
  
  const pipeline = [
    {
      $match: {
        assignedTo: new mongoose.Types.ObjectId(staffId),
        'timing.assignmentProcessedAt': { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: null,
        totalAssignments: { $sum: 1 },
        acceptedAssignments: {
          $sum: {
            $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0]
          }
        },
        avgResponseTime: { $avg: '$metrics.responseTime' },
        slaCompliance: {
          $avg: {
            $cond: [{ $eq: ['$metrics.isWithinSLA', true] }, 1, 0]
          }
        },
        reassignments: { $sum: '$metrics.reassignmentCount' }
      }
    }
  ];
  
  const result = await this.aggregate(pipeline);
  return result[0] || {};
};

module.exports = mongoose.model('AssignmentLog', assignmentLogSchema);