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
            "hours": 20
          },
          {
            "memberId": "member6",
            "hours": 20
          }
        ]
      }
    ]
  }'

# 8. Get the provider node again to see all updates
echo -e "\n${BLUE}8. Getting the provider node with all updates${NC}"
curl -s -X GET "$BASE_URL/$PROVIDER_ID"

# 9. Delete the provider node
echo -e "\n${BLUE}9. Deleting the provider node${NC}"
curl -s -X DELETE "$BASE_URL/$PROVIDER_ID"

# 10. Try to get the deleted provider node
echo -e "\n${BLUE}10. Trying to get the deleted provider node${NC}"
curl -s -X GET "$BASE_URL/$PROVIDER_ID"

echo -e "\n${GREEN}Provider API tests completed${NC}" 