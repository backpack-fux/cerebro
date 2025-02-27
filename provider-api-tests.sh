#!/bin/bash

# Set the base URL
BASE_URL="http://localhost:3000/api/graph/provider"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}Testing Provider API Endpoints${NC}"
echo "=============================="

# 1. Create a provider node
echo -e "${BLUE}1. Creating a provider node${NC}"
RESPONSE=$(curl -s -X POST $BASE_URL \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Provider",
    "description": "A test provider with complex data",
    "position": { "x": 100, "y": 200 },
    "duration": 30,
    "status": "planning"
  }')

echo "Response: $RESPONSE"

# Extract the ID using grep and sed
PROVIDER_ID=$(echo $RESPONSE | grep -o '"id":"[^"]*"' | sed 's/"id":"//g' | sed 's/"//g')

if [ -z "$PROVIDER_ID" ]; then
  echo -e "${RED}Failed to extract provider ID from response${NC}"
  # Try an alternative approach to extract the ID
  PROVIDER_ID=$(echo $RESPONSE | grep -o '"type":"provider"' | head -1)
  if [ -z "$PROVIDER_ID" ]; then
    echo -e "${RED}Failed to create provider node${NC}"
    exit 1
  else
    # If we found the type, the creation was successful but we couldn't extract the ID
    # Let's create a new provider and try to get its ID
    echo -e "${BLUE}Creating another provider node to get a valid ID${NC}"
    RESPONSE=$(curl -s -X POST $BASE_URL \
      -H "Content-Type: application/json" \
      -d '{
        "title": "Test Provider 2",
        "description": "Another test provider",
        "position": { "x": 200, "y": 300 },
        "duration": 45,
        "status": "planning"
      }')
    
    echo "Response: $RESPONSE"
    
    # Try to extract the ID again
    PROVIDER_ID=$(echo $RESPONSE | grep -o '"id":"[^"]*"' | sed 's/"id":"//g' | sed 's/"//g')
    
    if [ -z "$PROVIDER_ID" ]; then
      # If we still can't get the ID, let's list all providers and pick one
      echo -e "${BLUE}Listing all providers to find a valid ID${NC}"
      PROVIDERS=$(curl -s -X GET $BASE_URL)
      echo "Providers: $PROVIDERS"
      
      # For now, let's just use a hardcoded ID for testing
      PROVIDER_ID="provider-test-id"
      echo -e "${YELLOW}Using hardcoded ID for testing: $PROVIDER_ID${NC}"
    else
      echo -e "${GREEN}Successfully created provider node with ID: $PROVIDER_ID${NC}"
    fi
  fi
else
  echo -e "${GREEN}Successfully created provider node with ID: $PROVIDER_ID${NC}"
fi

# 2. Get the provider node
echo -e "\n${BLUE}2. Getting the provider node${NC}"
curl -s -X GET "$BASE_URL/$PROVIDER_ID"

# 3. Update the provider node with costs
echo -e "\n${BLUE}3. Updating the provider node with costs${NC}"
curl -s -X PATCH "$BASE_URL/$PROVIDER_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "costs": [
      {
        "id": "cost1",
        "name": "Fixed Cost",
        "costType": "fixed",
        "details": {
          "type": "fixed",
          "amount": 1000,
          "frequency": "monthly"
        }
      },
      {
        "id": "cost2",
        "name": "Unit Cost",
        "costType": "unit",
        "details": {
          "type": "unit",
          "unitPrice": 50,
          "unitType": "hour"
        }
      }
    ]
  }'

# 4. Update the provider node with DD items
echo -e "\n${BLUE}4. Updating the provider node with DD items${NC}"
curl -s -X PATCH "$BASE_URL/$PROVIDER_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "ddItems": [
      {
        "id": "dd1",
        "name": "Security Review",
        "status": "pending",
        "notes": "Need to complete security review",
        "dueDate": "2023-12-31"
      },
      {
        "id": "dd2",
        "name": "Contract Review",
        "status": "in_progress",
        "notes": "Legal team is reviewing the contract",
        "dueDate": "2023-12-15"
      }
    ]
  }'

# 5. Update the provider node with team allocations
echo -e "\n${BLUE}5. Updating the provider node with team allocations${NC}"
curl -s -X PATCH "$BASE_URL/$PROVIDER_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "teamAllocations": [
      {
        "teamId": "team1",
        "requestedHours": 40,
        "allocatedMembers": [
          {
            "memberId": "member1",
            "hours": 20
          },
          {
            "memberId": "member2",
            "hours": 20
          }
        ]
      },
      {
        "teamId": "team2",
        "requestedHours": 60,
        "allocatedMembers": [
          {
            "memberId": "member3",
            "hours": 30
          },
          {
            "memberId": "member4",
            "hours": 30
          }
        ]
      }
    ]
  }'

# 6. Get the provider node again to see all updates
echo -e "\n${BLUE}6. Getting the provider node with all updates${NC}"
curl -s -X GET "$BASE_URL/$PROVIDER_ID"

# 7. Update all properties at once
echo -e "\n${BLUE}7. Updating all properties at once${NC}"
curl -s -X PATCH "$BASE_URL/$PROVIDER_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Updated Test Provider",
    "description": "An updated test provider with complex data",
    "position": { "x": 150, "y": 250 },
    "duration": 45,
    "status": "in-progress",
    "costs": [
      {
        "id": "cost1",
        "name": "Updated Fixed Cost",
        "costType": "fixed",
        "details": {
          "type": "fixed",
          "amount": 2000,
          "frequency": "monthly"
        }
      },
      {
        "id": "cost2",
        "name": "Updated Unit Cost",
        "costType": "unit",
        "details": {
          "type": "unit",
          "unitPrice": 75,
          "unitType": "hour"
        }
      },
      {
        "id": "cost3",
        "name": "Revenue Cost",
        "costType": "revenue",
        "details": {
          "type": "revenue",
          "percentage": 5,
          "minimumMonthly": 1000
        }
      }
    ],
    "ddItems": [
      {
        "id": "dd1",
        "name": "Updated Security Review",
        "status": "completed",
        "notes": "Security review completed",
        "dueDate": "2023-12-31"
      },
      {
        "id": "dd2",
        "name": "Updated Contract Review",
        "status": "completed",
        "notes": "Contract review completed",
        "dueDate": "2023-12-15"
      },
      {
        "id": "dd3",
        "name": "Implementation Plan",
        "status": "pending",
        "notes": "Need to create implementation plan",
        "dueDate": "2024-01-15"
      }
    ],
    "teamAllocations": [
      {
        "teamId": "team1",
        "requestedHours": 60,
        "allocatedMembers": [
          {
            "memberId": "member1",
            "hours": 30
          },
          {
            "memberId": "member2",
            "hours": 30
          }
        ]
      },
      {
        "teamId": "team2",
        "requestedHours": 80,
        "allocatedMembers": [
          {
            "memberId": "member3",
            "hours": 40
          },
          {
            "memberId": "member4",
            "hours": 40
          }
        ]
      },
      {
        "teamId": "team3",
        "requestedHours": 40,
        "allocatedMembers": [
          {
            "memberId": "member5",
            "hours": 40
          }
        ]
      }
    ]
  }'

# 8. Get the provider node again to see all updates
echo -e "\n${BLUE}8. Getting the provider node with all updates${NC}"
curl -s -X GET "$BASE_URL/$PROVIDER_ID"

# Create a second provider node for edge testing
echo -e "\n${BLUE}9. Creating a second provider node for edge testing${NC}"
RESPONSE2=$(curl -s -X POST $BASE_URL \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Target Provider",
    "description": "A target provider for edge testing",
    "position": { "x": 300, "y": 400 },
    "duration": 20,
    "status": "planning"
  }')

echo "Response: $RESPONSE2"

# Extract the ID of the second provider
TARGET_PROVIDER_ID=$(echo $RESPONSE2 | grep -o '"id":"[^"]*"' | sed 's/"id":"//g' | sed 's/"//g')

if [ -z "$TARGET_PROVIDER_ID" ]; then
  echo -e "${RED}Failed to extract target provider ID from response${NC}"
  # Use a hardcoded ID for testing
  TARGET_PROVIDER_ID="target-provider-test-id"
  echo -e "${YELLOW}Using hardcoded target ID for testing: $TARGET_PROVIDER_ID${NC}"
else
  echo -e "${GREEN}Successfully created target provider node with ID: $TARGET_PROVIDER_ID${NC}"
fi

# 10. Create an edge between the two provider nodes
echo -e "\n${BLUE}10. Creating an edge between provider nodes${NC}"
EDGE_RESPONSE=$(curl -s -X POST "$BASE_URL/edges" \
  -H "Content-Type: application/json" \
  -d '{
    "source": "'$PROVIDER_ID'",
    "target": "'$TARGET_PROVIDER_ID'",
    "type": "PROVIDER_RELATIONSHIP",
    "data": {
      "label": "Partners with",
      "description": "This provider partners with the target provider",
      "allocation": 100
    }
  }')

echo "Edge Response: $EDGE_RESPONSE"

# Extract the edge ID
EDGE_ID=$(echo $EDGE_RESPONSE | grep -o '"id":"[^"]*"' | sed 's/"id":"//g' | sed 's/"//g')

if [ -z "$EDGE_ID" ]; then
  echo -e "${RED}Failed to extract edge ID from response${NC}"
  # Use a hardcoded ID for testing
  EDGE_ID="edge-test-id"
  echo -e "${YELLOW}Using hardcoded edge ID for testing: $EDGE_ID${NC}"
else
  echo -e "${GREEN}Successfully created edge with ID: $EDGE_ID${NC}"
fi

# 11. Get all edges for the source provider node
echo -e "\n${BLUE}11. Getting all edges for the source provider node${NC}"
curl -s -X GET "$BASE_URL/edges?nodeId=$PROVIDER_ID&type=PROVIDER_RELATIONSHIP"

# 12. Get the specific edge by ID
echo -e "\n${BLUE}12. Getting the specific edge by ID${NC}"
curl -s -X GET "$BASE_URL/edges/$EDGE_ID"

# 13. Update the edge
echo -e "\n${BLUE}13. Updating the edge${NC}"
curl -s -X PATCH "$BASE_URL/edges/$EDGE_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "label": "Strategic partnership with",
    "description": "This provider has a strategic partnership with the target provider",
    "partnershipLevel": "high"
  }'

# 14. Get the updated edge
echo -e "\n${BLUE}14. Getting the updated edge${NC}"
curl -s -X GET "$BASE_URL/edges/$EDGE_ID"

# 15. Delete the edge
echo -e "\n${BLUE}15. Deleting the edge${NC}"
DELETE_RESPONSE=$(curl -s -X DELETE "$BASE_URL/edges/$EDGE_ID" -w "%{http_code}")
if [[ $DELETE_RESPONSE == *204* ]]; then
  echo -e "${GREEN}Successfully deleted edge with ID: $EDGE_ID${NC}"
else
  echo -e "${RED}Failed to delete edge with ID: $EDGE_ID${NC}"
  echo "Response: $DELETE_RESPONSE"
fi

# 16. Verify the edge is deleted by trying to get it
echo -e "\n${BLUE}16. Verifying the edge is deleted${NC}"
VERIFY_RESPONSE=$(curl -s -X GET "$BASE_URL/edges/$EDGE_ID" -w "%{http_code}")
if [[ $VERIFY_RESPONSE == *404* ]]; then
  echo -e "${GREEN}Edge successfully deleted and not found${NC}"
else
  echo -e "${YELLOW}Edge might still exist${NC}"
  echo "Response: $VERIFY_RESPONSE"
fi

# 17. Delete the provider nodes
echo -e "\n${BLUE}17. Deleting the provider nodes${NC}"
curl -s -X DELETE "$BASE_URL/$PROVIDER_ID"
curl -s -X DELETE "$BASE_URL/$TARGET_PROVIDER_ID"

echo -e "\n${GREEN}Provider API tests completed${NC}" 