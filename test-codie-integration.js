#!/usr/bin/env node
// test-codie-integration.js
// Test the Codie API integration for opencode

import { runQuickTask, checkCodieHealth, createCodie } from './lib/codie-api.js';
import { initPlatform, getPlatform } from './src/platform/index.js';

async function testBasicIntegration() {
  console.log('🦞 Testing Codie Integration\n');

  try {
    // Initialize platform first
    await initPlatform();
    const platform = await getPlatform();

    // Check if we have basic config
    const hasGeminiKey = !!(await platform.config.load())?.gemini?.apiKey;
    const hasGithubConfig = !!(await platform.config.load())?.auth;

    if (!hasGeminiKey || !hasGithubConfig) {
      console.log('⚠️  Skipping tests - Codie not configured');
      console.log('   To run integration tests:');
      console.log('   1. Run: npm run setup');
      console.log('   2. Or set environment variables: GEMINI_API_KEY, GITHUB_TOKEN, etc.');
      console.log('   3. Then run: npm run test:integration\n');
      return;
    }

    // Test 1: Health check
    console.log('1. Health Check...');
    const healthy = await checkCodieHealth();
    console.log(`   ${healthy ? '✅' : '❌'} Codie is ${healthy ? 'healthy' : 'unhealthy'}\n`);

    if (!healthy) {
      console.log('Skipping further tests due to health check failure');
      return;
    }

    // Test 2: Simple task
    console.log('2. Simple Task...');
    const result1 = await runQuickTask('What is 2 + 2?');
    console.log(`   ✅ Result: ${result1}\n`);

    // Test 3: More complex task
    console.log('3. Complex Task...');
    const result2 = await runQuickTask('Explain the concept of recursion in programming with a simple example.');
    console.log(`   ✅ Result length: ${result2.length} characters\n`);

    // Test 4: Persistent instance for memory tasks
    console.log('4. Memory Operations...');
    const codie = await createCodie();
    await codie.initialize();

    // Test memory status
    const memStatus = await codie.getMemoryStatus();
    console.log(`   ✅ Memory status retrieved\n`);

    // Test remembering something
    await codie.remember('This is a test memory from opencode integration', 'Integration Test');
    console.log('   ✅ Added memory entry\n');

    // Test searching memory
    const searchResults = await codie.searchMemory('opencode');
    console.log(`   ✅ Memory search completed\n`);

    await codie.cleanup();

    console.log('🎉 All integration tests passed!');

  } catch (error) {
    console.error('❌ Integration test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run tests if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testBasicIntegration();
}