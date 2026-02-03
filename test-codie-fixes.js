#!/usr/bin/env node
// test-navigator-fixes.js
// Test the fixes for LLM call and GitHub file update issues

console.log('🧭 Testing Navigator Integration Fixes\n');

async function testLLMErrorHandling() {
  console.log('1. Testing LLM error handling...');

  try {
    // Import the fixed AgentLoopGitHub
    const { default: AgentLoopGitHub } = await import('./src/AgentLoop-GitHub.js');

    // Create a minimal instance to test the callLLM method
    const mockTools = new Map();
    const mockFS = {
      readFile: async () => ({ content: '{}' }),
      writeFile: async () => ({}),
      exists: async () => true
    };

    const agent = new AgentLoopGitHub('test goal', [], {
      fs: mockFS,
      verbose: false,
      maxIterations: 1
    });

    // Mock the tools
    agent.tools = mockTools;

    // This should fail gracefully with a proper error message
    try {
      await agent.callLLM('test prompt');
    } catch (error) {
      if (error.message.includes('Gemini API error') || error.message.includes('API key')) {
        console.log('   ✅ LLM error handling works - proper error message');
        return true;
      } else {
        console.log('   ❌ Unexpected error:', error.message);
        return false;
      }
    }

    console.log('   ❌ Expected error but got success');
    return false;

  } catch (error) {
    console.log('   ❌ Failed to test LLM error handling:', error.message);
    return false;
  }
}

async function testGitHubFileUpdateRetry() {
  console.log('2. Testing GitHub file update retry logic...');

  try {
    // Import GitHubFileSystem
    const { default: GitHubFileSystem } = await import('./src/GitHubFileSystem.js');

    // Create a mock config
    const config = {
      owner: 'test',
      repo: 'test',
      branch: 'main',
      auth: 'test-token',
      email: 'test@example.com'
    };

    const fs = new GitHubFileSystem(config);

    // Mock the octokit to simulate SHA conflict
    let callCount = 0;
    fs.octokit = {
      rest: {
        repos: {
          createOrUpdateFileContents: async () => {
            callCount++;
            if (callCount === 1) {
              // First call fails with SHA mismatch
              const error = new Error('does not match df4ac8b5aaf84d8bfbe92e42ef7067fd5df40364');
              error.status = 409;
              throw error;
            } else {
              // Second call succeeds
              return {
                data: {
                  content: {
                    path: 'test.txt',
                    name: 'test.txt',
                    sha: 'new-sha',
                    size: 10
                  }
                }
              };
            }
          }
        }
      }
    };

    // Mock readFile to return different SHA on retry
    fs.readFile = async () => ({ sha: 'fresh-sha' });

    // This should retry and succeed
    const result = await fs.writeFile('test.txt', 'content');

    if (result && result.sha === 'new-sha') {
      console.log('   ✅ GitHub file update retry logic works');
      return true;
    } else {
      console.log('   ❌ File update did not succeed as expected');
      return false;
    }

  } catch (error) {
    console.log('   ❌ Failed to test GitHub file update retry:', error.message);
    return false;
  }
}

async function runTests() {
  const results = [];

  results.push(await testLLMErrorHandling());
  results.push(await testGitHubFileUpdateRetry());

  const passed = results.filter(Boolean).length;
  const total = results.length;

  console.log(`\n📊 Test Results: ${passed}/${total} passed`);

  if (passed === total) {
    console.log('🎉 All fixes are working correctly!');
  } else {
    console.log('⚠️  Some tests failed - fixes may need more work');
  }

  return passed === total;
}

runTests().catch(error => {
  console.error('Test runner failed:', error);
  process.exit(1);
});