// Test Neo4j Connection Script
// Run with: bun src/scripts/test-neo4j-connection.js

import neo4j from 'neo4j-driver';

async function testConnection() {
  // Use the same configuration as in the application
  const uri = process.env.NEXT_PUBLIC_NEO4J_URI || "bolt://localhost:7687";
  const username = process.env.NEXT_PUBLIC_NEO4J_USERNAME || "neo4j";
  const password = process.env.NEXT_PUBLIC_NEO4J_PASSWORD || "object-delta-slalom-escape-spiral-9411";

  console.log(`Testing Neo4j connection to: ${uri}`);
  console.log(`Using credentials: ${username}:****`);

  let driver;
  try {
    // Create a driver instance
    driver = neo4j.driver(
      uri,
      neo4j.auth.basic(username, password),
      {
        encrypted: false,
        trust: 'TRUST_ALL_CERTIFICATES',
      }
    );

    // Verify connectivity
    console.log('Verifying connection...');
    await driver.verifyConnectivity();
    console.log('✅ Connection successful!');

    // Test a simple query
    console.log('Testing simple query...');
    const session = driver.session();
    try {
      const result = await session.run('MATCH (n) RETURN count(n) as count');
      const count = result.records[0].get('count').toNumber();
      console.log(`✅ Query successful! Found ${count} nodes in the database.`);
    } finally {
      await session.close();
    }

    // Test the actual query used in the application
    console.log('Testing application query...');
    const appSession = driver.session();
    try {
      const query = `
        MATCH (n)
        OPTIONAL MATCH (n)-[r]->(m)
        RETURN n, r, m, n.id as sourceId, CASE WHEN m IS NOT NULL THEN m.id ELSE null END as targetId
      `;
      const result = await appSession.run(query);
      console.log(`✅ Application query successful! Retrieved ${result.records.length} records.`);
    } catch (error) {
      console.error('❌ Application query failed:', error);
    } finally {
      await appSession.close();
    }

  } catch (error) {
    console.error('❌ Connection failed:', error);
  } finally {
    if (driver) {
      await driver.close();
    }
  }
}

testConnection().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
}); 