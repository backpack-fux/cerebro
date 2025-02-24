/**
 * Configuration interface for Neo4j database connection.
 * Used in neo4j.config.ts and neo4j.service.ts for establishing
 * and maintaining the database connection.
 */
export interface Neo4jConfig {
    /** URI of the Neo4j database instance */
    uri: string;
    /** Username for authentication */
    username: string;
    /** Password for authentication */
    password: string;
    /** Whether to use encryption for the connection */
    encrypted?: boolean;
    /** Certificate trust settings for secure connections */
    trust?: "TRUST_ALL_CERTIFICATES" | "TRUST_SYSTEM_CA_SIGNED_CERTIFICATES"
}

function validateNeo4jUri(uri: string): boolean {
  try {
    const url = new URL(uri);
    const validProtocols = ["bolt:", "neo4j:"];

    return validProtocols.includes(url.protocol);
  } catch {
    return false;
  }
}

// Get environment-specific configuration
const getEnvironmentConfig = (): Neo4jConfig => {

  // Production environment (Vercel)
  if (process.env.NODE_ENV === "production") {
    const config: Neo4jConfig = {
      uri: process.env.NEO4J_URI || "",
      username: process.env.NEO4J_USERNAME || "",
      password: process.env.NEO4J_PASSWORD || "",
      encrypted: false,
      trust: "TRUST_ALL_CERTIFICATES" as const,
    };

    return config;
  }
  
  // Development environment (local)
  const config: Neo4jConfig = {
    uri: process.env.NEXT_PUBLIC_NEO4J_URI || "bolt://localhost:7687",
    username: process.env.NEXT_PUBLIC_NEO4J_USERNAME || "neo4j",
    password: process.env.NEXT_PUBLIC_NEO4J_PASSWORD || "object-delta-slalom-escape-spiral-9411",
    encrypted: false,
    trust: "TRUST_ALL_CERTIFICATES" as const,
  };

  return config;
};

export const neo4jConfig: Neo4jConfig = getEnvironmentConfig();

// Validate config
if (!neo4jConfig.uri || !neo4jConfig.username || !neo4jConfig.password) {
  throw new Error("Missing required Neo4j configuration");
}

if (!validateNeo4jUri(neo4jConfig.uri)) {
  throw new Error(
    `Invalid Neo4j URI format. URI must start with one of: bolt://, neo4j://`,
  );
}

if (process.env.NODE_ENV !== "production") {
  console.log("[Neo4jConfig] Configuration validated successfully");
}
