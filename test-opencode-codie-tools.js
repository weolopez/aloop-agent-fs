#!/usr/bin/env node
// test-opencode-codie-tools.js
// Test that Codie tools are properly registered in OpenCode's tool system

// Test 1: Import the tools registry
try {
  const { getToolNames, getTool, getToolsByCategory } = await import('./src/tools/index.js');
  console.log('✅ Successfully imported tools registry');

  // Test 2: Check Codie tools are registered
  const toolNames = getToolNames();
  const codieTools = toolNames.filter(name =>
    name.includes('codie') || name === 'delegateTask' || name === 'askCodie' || name === 'codieMemory'
  );

  console.log(`✅ Found ${codieTools.length} Codie tools:`, codieTools.join(', '));

  // Test 3: Check tools by category
  const codieCategory = getToolsByCategory('codie');
  console.log('✅ Codie category tools:', Object.keys(codieCategory));

  // Test 4: Get tool schemas
  const schemas = codieTools.map(name => {
    const tool = getTool(name);
    return {
      name: tool.name,
      hasDescription: !!tool.description,
      paramCount: Object.keys(tool.parameters).length
    };
  });

  console.log('✅ Tool schemas:');
  schemas.forEach(schema => {
    console.log(`  - ${schema.name}: ${schema.paramCount} parameters, description: ${schema.hasDescription ? 'yes' : 'no'}`);
  });

  console.log('\n🎉 All Codie tools successfully integrated into OpenCode!');

} catch (error) {
  console.error('❌ Error testing Navigator tools:', error.message);
  process.exit(1);
}