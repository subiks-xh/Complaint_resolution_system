#!/usr/bin/env node

/**
 * Test Assignment System
 * 
 * This script tests the enhanced assignment features:
 * - Assignment rules configuration
 * - Performance tracking
 * - SLA integration
 * - Smart staff recommendations
 */

const axios = require('axios');

const BASE_URL = process.env.ASSIGNMENT_TEST_BASE_URL || 'http://localhost:5001/api';

// Test configuration
const testConfig = {
  adminCredentialsCandidates: [
    {
      email: process.env.ASSIGNMENT_TEST_ADMIN_EMAIL || 'admin@example.com',
      password: process.env.ASSIGNMENT_TEST_ADMIN_PASSWORD || 'AdminPass1!'
    },
    {
      email: 'admin@example.com',
      password: 'password123'
    },
    {
      email: 'qa.admin@local.test',
      password: 'AdminPass1!'
    }
  ],
  testComplaintId: null,
  testStaffId: null,
  authToken: null,
  loggedInAs: null
};

async function main() {
  console.log('🧪 Testing Enhanced Assignment System\n');
  
  try {
    // Step 1: Login as admin
    await loginAsAdmin();
    
    // Step 2: Test assignment rules API
    await testAssignmentRulesAPI();
    
    // Step 3: Test enhanced staff data
    await testEnhancedStaffData();
    
    // Step 4: Test assignment with configuration
    await testAssignmentWithConfig();
    
    // Step 5: Test SLA information
    await testSLAInfo();
    
    console.log('\n✅ All assignment system tests completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.response?.data || error.message);
    process.exit(1);
  }
}

async function loginAsAdmin() {
  console.log('🔐 Logging in as admin...');

  let lastError = null;

  for (const credentials of testConfig.adminCredentialsCandidates) {
    try {
      const response = await axios.post(`${BASE_URL}/auth/login`, credentials);
      testConfig.authToken = response.data.data.accessToken;
      testConfig.loggedInAs = credentials.email;
      console.log(`✅ Admin login successful (${credentials.email})\n`);
      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error('Failed to login as admin: ' + (lastError?.response?.data?.message || lastError?.message || 'No valid admin credentials found'));
}

async function testAssignmentRulesAPI() {
  console.log('📋 Testing Assignment Rules API...');
  
  const headers = { Authorization: `Bearer ${testConfig.authToken}` };
  
  try {
    // Test creating a rule
    const createRuleData = {
      name: "Test Auto-Assignment Rule",
      description: "Automated rule for testing",
      conditions: {
        priorities: ["high", "critical"],
        maxWorkload: { enabled: true, percentage: 75 },
        skillMatching: { enabled: true, strictMode: false }
      },
      actions: {
        assignmentMethod: "least_loaded",
        autoAssign: true,
        notificationSettings: {
          assigneeNotification: true,
          userNotification: false
        }
      },
      isActive: true,
      priority: 1
    };
    
    const createResponse = await axios.post(
      `${BASE_URL}/admin/assignment-rules`, 
      createRuleData, 
      { headers }
    );
    
    const ruleId = createResponse.data.data._id;
    console.log(`✅ Assignment rule created: ${ruleId}`);
    
    // Test getting rules
    const getRulesResponse = await axios.get(`${BASE_URL}/admin/assignment-rules`, { headers });
    console.log(`✅ Retrieved ${getRulesResponse.data.data.rules.length} assignment rules`);
    
    // Test updating rule
    await axios.put(
      `${BASE_URL}/admin/assignment-rules/${ruleId}`,
      { ...createRuleData, name: "Updated Test Rule" },
      { headers }
    );
    console.log('✅ Assignment rule updated');
    
    // Clean up - delete test rule
    await axios.delete(`${BASE_URL}/admin/assignment-rules/${ruleId}`, { headers });
    console.log('✅ Test assignment rule cleaned up\n');
    
  } catch (error) {
    throw new Error('Assignment rules API test failed: ' + (error.response?.data?.message || error.message));
  }
}

async function testEnhancedStaffData() {
  console.log('👥 Testing Enhanced Staff Data...');
  
  const headers = { Authorization: `Bearer ${testConfig.authToken}` };
  
  try {
    const response = await axios.get(`${BASE_URL}/admin/staff/available`, { headers });
    const staff = response.data.data;
    
    if (staff.length > 0) {
      const firstStaff = staff[0];
      testConfig.testStaffId = firstStaff._id;
      
      console.log(`✅ Found ${staff.length} available staff members`);
      console.log(`✅ First staff recommendation score: ${firstStaff.recommendationScore || 'N/A'}`);
      console.log(`✅ Performance metrics included: ${firstStaff.performanceMetrics ? 'Yes' : 'No'}`);
    } else {
      console.log('⚠️  No staff members available for testing');
    }
    
    console.log('');
    
  } catch (error) {
    throw new Error('Enhanced staff data test failed: ' + (error.response?.data?.message || error.message));
  }
}

async function testAssignmentWithConfig() {
  console.log('🎯 Testing Assignment with Configuration...');
  
  const headers = { Authorization: `Bearer ${testConfig.authToken}` };
  
  try {
    // First get a complaint to test with
    const complaintsResponse = await axios.get(`${BASE_URL}/admin/complaints?limit=1`, { headers });
    
    if (complaintsResponse.data.data.complaints.length === 0) {
      console.log('⚠️  No complaints available for assignment testing');
      return;
    }
    
    const testComplaint = complaintsResponse.data.data.complaints[0];
    testConfig.testComplaintId = testComplaint._id;
    
    if (!testConfig.testStaffId) {
      console.log('⚠️  No staff available for assignment testing');
      return;
    }
    
    // Test assignment with enhanced configuration
    const assignmentConfig = {
      staffId: testConfig.testStaffId,
      assignmentConfig: {
        priority: "high",
        assignmentType: "immediate",
        notifyAssignee: true,
        notifyUser: true,
        escalationRules: true,
        assignmentNotes: "Test assignment with enhanced configuration"
      }
    };
    
    const assignResponse = await axios.post(
      `${BASE_URL}/admin/complaints/${testConfig.testComplaintId}/assign`,
      assignmentConfig,
      { headers }
    );
    
    console.log('✅ Enhanced assignment completed successfully');
    console.log(`✅ Assignment log ID: ${assignResponse.data.data.assignmentLog || 'N/A'}`);
    console.log('');
    
  } catch (error) {
    // If complaint is already assigned, that's expected
    if (error.response?.status === 400 && error.response.data.message.includes('already assigned')) {
      console.log('✅ Assignment test passed (complaint already assigned)');
      console.log('');
      return;
    }
    throw new Error('Assignment configuration test failed: ' + (error.response?.data?.message || error.message));
  }
}

async function testSLAInfo() {
  console.log('⏰ Testing SLA Information...');
  
  const headers = { Authorization: `Bearer ${testConfig.authToken}` };
  
  try {
    const response = await axios.get(
      `${BASE_URL}/admin/sla-info?priority=high`, 
      { headers }
    );
    
    const slaInfo = response.data.data;
    console.log(`✅ SLA Time Limit: ${slaInfo.timeLimit} hours`);
    console.log(`✅ Response Time: ${slaInfo.responseTime} hours`);
    console.log(`✅ Escalation Enabled: ${slaInfo.escalationEnabled}`);
    console.log('');
    
  } catch (error) {
    throw new Error('SLA info test failed: ' + (error.response?.data?.message || error.message));
  }
}

// Handle uncaught errors
process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
  process.exit(1);
});

// Run the tests
if (require.main === module) {
  main();
}

module.exports = { main };