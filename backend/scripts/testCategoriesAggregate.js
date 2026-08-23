#!/usr/bin/env node
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');

const Category = require('../models/Category');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/complaint_system';

(async function(){
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to DB');

    const query = { isActive: true };

    const pipeline = [
      { $match: query },
      { $sort: { displayOrder: 1, name: 1 } },
      {
        $lookup: {
          from: 'complaints',
          localField: '_id',
          foreignField: 'category',
          as: 'complaints',
        }
      },
      {
        $addFields: {
          complaintCount: { $size: '$complaints' },
          activeComplaints: {
            $size: {
              $filter: {
                input: '$complaints',
                as: 'c',
                // Use $not + $in (aggregation expressions don't support $nin)
                cond: { $not: { $in: ['$$c.status', ['resolved', 'closed']] } },
              }
            }
          }
        }
      },
      { $project: { complaints: 0 } }
    ];

    const res = await Category.aggregate(pipeline);
    console.log('Aggregate result count:', res.length);
    console.dir(res.slice(0,3), { depth: 3 });

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Aggregate error:', err);
    try { await mongoose.disconnect(); } catch(e){}
    process.exit(1);
  }
})();
