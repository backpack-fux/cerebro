/**
 * Centralized Cypher queries for graph operations.
 * All queries use Neo4j's internal IDs (accessed via ID(n) function) rather than custom id properties.
 * This ensures consistency with our ID type system:
 * - Neo4jId: number (used in queries)
 * - SerializedNeo4jId: string (used in storage/transmission)
 * - ReactFlowId: string (used in UI)
 * 
 * Note: While we use Neo4j's internal IDs for querying, we still maintain a UUID
 * property for node uniqueness in merge operations. This UUID is not used for
 * relationships or queries, which continue to use Neo4j's internal IDs.
 */
// export const CYPHER_QUERIES = {
//     // Graph-wide operations
//     GET_FULL_GRAPH: `
//       MATCH (n)
//       WITH collect(n) as nodes
//       OPTIONAL MATCH (a)-[r]->(b)
//       RETURN nodes as n, collect(r) as r, collect(b) as m
//     `,
  
//     GET_NODE_BY_ID: `
//       MATCH (n)
//       WHERE ID(n) = $id
//       RETURN n
//     `,
  
//     // Node operations
//     CREATE_NODE: `
//       CREATE (n)
//       WITH n
//       CALL apoc.create.addLabels([n], [$type]) YIELD node
//       WITH node
//       SET node += $properties
//       RETURN node as n, ID(node) as internalId
//     `,
  
//     UPDATE_NODE: `
//       MATCH (n)
//       WHERE ID(n) = $nodeId
//       WITH n, $properties as props
//       UNWIND keys(props) as key
//       CALL apoc.create.setProperty(n, key, props[key])
//       YIELD node
//       RETURN node as n
//     `,
  
//     // Label operations
//     ADD_LABEL: `
//       MATCH (n) WHERE ID(n) = $nodeId
//       CALL apoc.create.addLabels([n], [$label]) YIELD node
//       RETURN node
//     `,
  
//     REMOVE_LABEL: `
//       MATCH (n) WHERE ID(n) = $nodeId
//       CALL apoc.create.removeLabels([n], [$label]) YIELD node
//       RETURN node
//     `,
  
//     SET_LABELS: `
//       MATCH (n) WHERE ID(n) = $nodeId
//       CALL apoc.create.setLabels(n, $labels) YIELD node
//       RETURN node
//     `,
  
//     GET_NODE: `
//       MATCH (n)
//       WHERE ID(n) = $nodeId
//       RETURN n
//     `,
  
//     GET_NODES_BY_TYPE: `
//       MATCH (n)
//       WHERE $type in labels(n)
//       RETURN n
//     `,
  
//     DELETE_NODE: `
//       MATCH (n)
//       WHERE ID(n) = $nodeId
//       DETACH DELETE n
//     `,
  
//     // Relationship operations
//     CREATE_RELATIONSHIP: `
//       MATCH (from) WHERE ID(from) = $fromId
//       MATCH (to) WHERE ID(to) = $toId
//       CALL apoc.merge.relationship(from, $type, {}, $properties, to)
//       YIELD rel as r
//       RETURN r
//     `,
  
//     GET_RELATIONSHIPS: `
//       MATCH (n)-[r]->(m)
//       WHERE ID(n) = $nodeId
//       RETURN r, m
//     `,
  
//     DELETE_RELATIONSHIP: `
//       MATCH (n)-[r]->(m)
//       WHERE ID(n) = $fromId AND ID(m) = $toId AND toUpper(type(r)) = toUpper($type)
//       DELETE r
//     `,

//     CREATE_META_NODE: `
//         CREATE (n:MetaNode {
//             id: $id, // String ID for React Flow compatibility
//             name: $name,
//             description: $description,
//             title: $title,
//             createdAt: $createdAt,
//             updatedAt: $updatedAt,
//             positionX: $positionX,
//             positionY: $positionY
//         })
//         RETURN n
//     `,

//     UPDATE_META_NODE: `
//         MATCH (n:MetaNode {
//             id: $id
//         }) 
//         SET 
//             n.title = $title, 
//             n.description = $description, 
//             n.updatedAt = $updatedAt, 
//             n.positionX = $positionX, 
//             n.positionY = $positionY 
//         RETURN n
//     `,

//     GET_META_NODE: `
//         MATCH (n:MetaNode {
//             id: $id
//         }) 
//         RETURN n
//     `,

//     DELETE_META_NODE: `
//         MATCH (n:MetaNode {
//             id: $id
//         }) 
//         DETACH DELETE n
//     `
// } as const;

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
      MATCH (n {id: $nodeId})-[r]->(m) 
      WHERE toUpper(type(r)) = toUpper($type) OR $type IS NULL 
      RETURN r, n.id as sourceId, m.id as targetId
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