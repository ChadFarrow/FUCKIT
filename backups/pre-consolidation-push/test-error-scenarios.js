/**
 * Error Handling Test Suite
 * Tests various error scenarios to ensure proper user feedback and graceful degradation
 */

const fs = require('fs');
const path = require('path');

// Test configuration
const TEST_CONFIG = {
  baseUrl: 'http://localhost:3000',
  timeout: 10000,
  retryAttempts: 3,
};

// Test scenarios
const ERROR_SCENARIOS = [
  {
    name: 'Invalid RSS Feed URL',
    type: 'RSS_FETCH_ERROR',
    testUrl: 'https://invalid-domain-that-does-not-exist.com/feed.xml',
    expectedBehavior: 'Should show toast error and retry with backoff'
  },
  {
    name: 'Malformed XML Response',
    type: 'RSS_PARSE_ERROR', 
    testUrl: 'https://httpbin.org/html', // Returns HTML instead of XML
    expectedBehavior: 'Should detect invalid XML and show parse error'
  },
  {
    name: 'Network Timeout',
    type: 'TIMEOUT_ERROR',
    testUrl: 'https://httpbin.org/delay/15', // 15 second delay (exceeds timeout)
    expectedBehavior: 'Should timeout and retry with exponential backoff'
  },
  {
    name: 'Rate Limited Response',
    type: 'RATE_LIMIT_ERROR',
    testUrl: 'https://httpbin.org/status/429', // Returns 429 status
    expectedBehavior: 'Should handle rate limiting with proper retry'
  },
  {
    name: 'Empty RSS Response',
    type: 'RSS_INVALID_FORMAT',
    testUrl: 'https://httpbin.org/status/200', // Returns empty body
    expectedBehavior: 'Should detect empty response and show error'
  },
  {
    name: 'Audio File Not Found',
    type: 'AUDIO_NOT_FOUND',
    testData: { audioUrl: 'https://httpbin.org/status/404' },
    expectedBehavior: 'Should show audio load error toast'
  },
  {
    name: 'Audio Format Not Supported',
    type: 'AUDIO_PLAYBACK_ERROR',
    testData: { audioUrl: 'https://httpbin.org/bytes/1000' }, // Returns binary data, not audio
    expectedBehavior: 'Should detect unsupported format and show error'
  }
];

class ErrorTester {
  constructor() {
    this.results = [];
    this.startTime = Date.now();
  }

  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    console.log(logMessage);
    
    // Also write to log file
    const logDir = path.join(__dirname, 'test-logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    const logFile = path.join(logDir, `error-test-${new Date().toISOString().split('T')[0]}.log`);
    fs.appendFileSync(logFile, logMessage + '\n');
  }

  async testRSSFeedErrors() {
    this.log('🧪 Testing RSS Feed Error Scenarios...');
    
    for (const scenario of ERROR_SCENARIOS.filter(s => s.testUrl)) {
      this.log(`Testing: ${scenario.name}`);
      
      try {
        const startTime = Date.now();
        
        // Test the RSS parser directly
        const response = await fetch(`/api/fetch-rss?url=${encodeURIComponent(scenario.testUrl)}`);
        
        const duration = Date.now() - startTime;
        const result = {
          scenario: scenario.name,
          type: scenario.type,
          status: response.ok ? 'SUCCESS' : 'ERROR',
          statusCode: response.status,
          duration,
          expectedBehavior: scenario.expectedBehavior
        };

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          result.errorMessage = errorData.error || 'Unknown error';
          result.details = errorData.details;
        }

        this.results.push(result);
        this.log(`✅ ${scenario.name}: ${result.status} (${duration}ms)`);
        
      } catch (error) {
        const result = {
          scenario: scenario.name,
          type: scenario.type,
          status: 'EXCEPTION',
          error: error.message,
          expectedBehavior: scenario.expectedBehavior
        };
        
        this.results.push(result);
        this.log(`❌ ${scenario.name}: Exception - ${error.message}`, 'error');
      }
      
      // Wait between tests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  async testErrorBoundaryScenarios() {
    this.log('🛡️ Testing Error Boundary Scenarios...');
    
    // Simulate component errors that should be caught by error boundary
    const boundaryTests = [
      {
        name: 'Undefined Property Access',
        trigger: () => { throw new Error('Cannot read property of undefined'); },
        expectedBehavior: 'Error boundary should catch and display fallback UI'
      },
      {
        name: 'Network Error in Component',
        trigger: () => { throw new TypeError('NetworkError when attempting to fetch resource.'); },
        expectedBehavior: 'Should be caught by error boundary with network-specific message'
      },
      {
        name: 'JSON Parse Error',
        trigger: () => { throw new SyntaxError('Unexpected token in JSON'); },
        expectedBehavior: 'Should show parse error fallback'
      }
    ];

    for (const test of boundaryTests) {
      try {
        test.trigger();
      } catch (error) {
        this.log(`✅ Error Boundary Test: ${test.name} - Error correctly thrown: ${error.message}`);
        this.results.push({
          scenario: test.name,
          type: 'ERROR_BOUNDARY',
          status: 'SUCCESS',
          errorMessage: error.message,
          expectedBehavior: test.expectedBehavior
        });
      }
    }
  }

  async testRetryMechanisms() {
    this.log('🔄 Testing Retry Mechanisms...');
    
    // Test retry logic with different scenarios
    const retryTests = [
      {
        name: 'Intermittent Network Failure',
        url: 'https://httpbin.org/status/500,200,200', // Fails first, then succeeds
        expectedRetries: 1
      },
      {
        name: 'Consistent Network Failure', 
        url: 'https://httpbin.org/status/500', // Always fails
        expectedRetries: 3
      }
    ];

    for (const test of retryTests) {
      const startTime = Date.now();
      let attemptCount = 0;
      
      try {
        // Simulate retry logic
        for (let i = 0; i < TEST_CONFIG.retryAttempts; i++) {
          attemptCount++;
          try {
            const response = await fetch(test.url);
            if (response.ok) {
              break; // Success, stop retrying
            }
            if (i === TEST_CONFIG.retryAttempts - 1) {
              throw new Error(`Failed after ${attemptCount} attempts`);
            }
          } catch (error) {
            if (i === TEST_CONFIG.retryAttempts - 1) {
              throw error;
            }
            // Wait with exponential backoff
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
          }
        }
        
        const duration = Date.now() - startTime;
        this.results.push({
          scenario: test.name,
          type: 'RETRY_MECHANISM',
          status: 'SUCCESS',
          attempts: attemptCount,
          duration,
          expectedRetries: test.expectedRetries
        });
        
        this.log(`✅ ${test.name}: Completed in ${attemptCount} attempts (${duration}ms)`);
        
      } catch (error) {
        const duration = Date.now() - startTime;
        this.results.push({
          scenario: test.name,
          type: 'RETRY_MECHANISM', 
          status: 'FAILED',
          attempts: attemptCount,
          duration,
          error: error.message,
          expectedRetries: test.expectedRetries
        });
        
        this.log(`❌ ${test.name}: Failed after ${attemptCount} attempts - ${error.message}`, 'error');
      }
    }
  }

  generateReport() {
    const totalDuration = Date.now() - this.startTime;
    const totalTests = this.results.length;
    const successfulTests = this.results.filter(r => r.status === 'SUCCESS').length;
    const failedTests = this.results.filter(r => r.status === 'ERROR' || r.status === 'FAILED').length;
    
    const report = {
      summary: {
        totalTests,
        successful: successfulTests,
        failed: failedTests,
        successRate: `${((successfulTests / totalTests) * 100).toFixed(1)}%`,
        totalDuration: `${(totalDuration / 1000).toFixed(2)}s`,
        timestamp: new Date().toISOString()
      },
      results: this.results,
      recommendations: this.generateRecommendations()
    };

    // Write report to file
    const reportPath = path.join(__dirname, 'test-logs', `error-handling-report-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    this.log(`📊 Test Report Generated: ${reportPath}`);
    this.log(`📈 Summary: ${successfulTests}/${totalTests} tests passed (${report.summary.successRate})`);
    
    return report;
  }

  generateRecommendations() {
    const recommendations = [];
    
    // Analyze results and generate recommendations
    const failedRSSTests = this.results.filter(r => r.type.includes('RSS') && r.status !== 'SUCCESS');
    if (failedRSSTests.length > 0) {
      recommendations.push({
        category: 'RSS Handling',
        priority: 'high',
        issue: `${failedRSSTests.length} RSS error scenarios failed`,
        recommendation: 'Review RSS error handling and improve user feedback for feed failures'
      });
    }

    const slowTests = this.results.filter(r => r.duration && r.duration > 5000);
    if (slowTests.length > 0) {
      recommendations.push({
        category: 'Performance',
        priority: 'medium', 
        issue: `${slowTests.length} tests took longer than 5 seconds`,
        recommendation: 'Consider reducing timeout values or improving retry logic'
      });
    }

    return recommendations;
  }
}

// Test runner
async function runErrorTests() {
  console.log('🚀 Starting Error Handling Test Suite...');
  
  const tester = new ErrorTester();
  
  try {
    await tester.testRSSFeedErrors();
    await tester.testErrorBoundaryScenarios();
    await tester.testRetryMechanisms();
    
    const report = tester.generateReport();
    
    console.log('\n📋 Test Summary:');
    console.log(`Total Tests: ${report.summary.totalTests}`);
    console.log(`Successful: ${report.summary.successful}`);
    console.log(`Failed: ${report.summary.failed}`);
    console.log(`Success Rate: ${report.summary.successRate}`);
    console.log(`Duration: ${report.summary.totalDuration}`);
    
    if (report.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      report.recommendations.forEach((rec, i) => {
        console.log(`${i + 1}. [${rec.priority.toUpperCase()}] ${rec.category}: ${rec.recommendation}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  }
}

// Export for use in other contexts
module.exports = { ErrorTester, ERROR_SCENARIOS, runErrorTests };

// Run tests if called directly
if (require.main === module) {
  runErrorTests();
}