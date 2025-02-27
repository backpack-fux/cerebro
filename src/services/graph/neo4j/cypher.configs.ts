// cypher.configs.ts
export const CYPHER_QUERIES = {
    GET_FULL_GRAPH: `
      MATCH (n)
      OPTIONAL MATCH (n)-[r]->(m)
      RETURN n, r, m, n.id as sourceId, CASE WHEN m IS NOT NULL THEN m.id ELSE null END as targetId
    `,
  
    // This query will be modified in the service to use string interpolation
    // for the node label since Neo4j doesn't support parameterized labels
    GET_NODES_BY_TYPE: `
      MATCH (n:TYPE_PLACEHOLDER) RETURN n
    `,

    GET_NODE_BY_ID: `
      MATCH (n {id: $id}) RETURN n
    `,
  
    // This query will be modified in the service to use string interpolation
    // for the node label since Neo4j doesn't support parameterized labels
    CREATE_NODE: `
      CREATE (n:TYPE_PLACEHOLDER {id: $id, positionX: $positionX, positionY: $positionY, createdAt: $createdAt, updatedAt: $updatedAt}) 
      SET n += $properties 
      RETURN n
    `,
  
    UPDATE_NODE: `
      MATCH (n {id: $id}) SET n.updatedAt = $updatedAt, n.positionX = $positionX, n.positionY = $positionY SET n += $properties RETURN n
    `,
  
    GET_NODE: `
      MATCH (n {id: $id}) RETURN n
    `,
  
    DELETE_NODE: `
      MATCH (n {id: $id}) DETACH DELETE n
    `,
  
    // Generic edge operations (using string id)
    CREATE_EDGE: `
      MATCH (source {id: $from}), (target {id: $to}) 
      CREATE (source)-[r:TYPE_PLACEHOLDER {id: $id, createdAt: $createdAt, updatedAt: $updatedAt}]->(target) 
      SET r += $properties RETURN r
    `,
  
    GET_EDGES: `
      MATCH (n {id: $nodeId})-[r]-(m) 
      WHERE toUpper(type(r)) = toUpper($type) OR $type IS NULL 
      RETURN r, startNode(r).id as sourceId, endNode(r).id as targetId
    `,
  
    GET_EDGE: `
      MATCH (source)-[r]->(target) WHERE r.id = $id RETURN r, source.id as sourceId, target.id as targetId
    `,
  
    UPDATE_EDGE: `
      MATCH (source)-[r]->(target) WHERE r.id = $id SET r.updatedAt = $updatedAt SET r += $properties RETURN r, source.id as sourceId, target.id as targetId
    `,
  
    DELETE_EDGE: `
      MATCH ()-[r]->() WHERE r.id = $id DELETE r
    `,
  } as const;