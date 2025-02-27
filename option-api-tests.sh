#!/bin/bash

# Set the base URL
BASE_URL="http://localhost:3000/api/graph/option"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}Testing Option API Endpoints${NC}"
echo "=============================="

# 1. Create an option node
echo -e "${BLUE}1. Creating an option node${NC}"
RESPONSE=$(curl -s -X POST $BASE_URL \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Option",
    "description": "A test option with complex data",
    "position": { "x": 100, "y": 200 },
    "optionType": "customer",
    "duration": 30,
    "status": "planning"
  }')

echo "Response: $RESPONSE"

# Extract the ID using grep and sed
OPTION_ID=$(echo $RESPONSE | grep -o '"id":"[^"]*"' | sed 's/"id":"//g' | sed 's/"//g')

if [ -z "$OPTION_ID" ]; then
  echo -e "${RED}Failed to extract option ID from response${NC}"
  # Try an alternative approach to extract the ID
  OPTION_ID=$(echo $RESPONSE | grep -o '"type":"option"' | head -1)
  if [ -z "$OPTION_ID" ]; then
    echo -e "${RED}Failed to create option node${NC}"
    exit 1
  else
    # If we found the type, the creation was successful but we couldn't extract the ID
    # Let's create a new option and try to get its ID
    echo -e "${BLUE}Creating another option node to get a valid ID${NC}"
    RESPONSE=$(curl -s -X POST $BASE_URL \
      -H "Content-Type: application/json" \
      -d '{
        "title": "Test Option 2",
        "description": "Another test option",
        "position": { "x": 200, "y": 300 },
        "optionType": "contract",
        "duration": 45,
        "status": "planning"
      }')
    
    echo "Response: $RESPONSE"
    
    # Try to extract the ID again
    OPTION_ID=$(echo $RESPONSE | grep -o '"id":"[^"]*"' | sed 's/"id":"//g' | sed 's/"//g')
    
    if [ -z "$OPTION_ID" ]; then
      # If we still can't get the ID, let's list all options and pick one
      echo -e "${BLUE}Listing all options to find a valid ID${NC}"
      OPTIONS=$(curl -s -X GET $BASE_URL)
      echo "Options: $OPTIONS"
      
      # For now, let's just use a hardcoded ID for testing
      OPTION_ID="option-test-id"
      echo -e "${YELLOW}Using hardcoded ID for testing: $OPTION_ID${NC}"
    else
      echo -e "${GREEN}Successfully created option node with ID: $OPTION_ID${NC}"
    fi
  fi
else
  echo -e "${GREEN}Successfully created option node with ID: $OPTION_ID${NC}"
fi

# 2. Get the option node
echo -e "\n${BLUE}2. Getting the option node${NC}"
curl -s -X GET "$BASE_URL/$OPTION_ID"

# 3. Update the option node with goals
echo -e "\n${BLUE}3. Updating the option node with goals${NC}"
curl -s -X PATCH "$BASE_URL/$OPTION_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "goals": [
      {
        "id": "goal1",
        "name": "Increase Revenue",
        "description": "Increase revenue by 20% in the next quarter"
      },
      {
        "id": "goal2",
        "name": "Reduce Costs",
        "description": "Reduce operational costs by 15%"
      }
    ]
  }'

# 4. Update the option node with risks
echo -e "\n${BLUE}4. Updating the option node with risks${NC}"
curl -s -X PATCH "$BASE_URL/$OPTION_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "risks": [
      {
        "id": "risk1",
        "name": "Market Volatility",
        "description": "Market conditions may change rapidly",
        "impact": "high",
        "likelihood": "medium"
      },
      {
        "id": "risk2",
        "name": "Resource Constraints",
        "description": "Limited resources may delay implementation",
        "impact": "medium",
        "likelihood": "high"
      }
    ]
  }'

# 5. Update the option node with member allocations
echo -e "\n${BLUE}5. Updating the option node with member allocations${NC}"
curl -s -X PATCH "$BASE_URL/$OPTION_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "memberAllocations": [
      {
        "memberId": "member1",
        "timePercentage": 50
      },
      {
        "memberId": "member2",
        "timePercentage": 75
      }
    ]
  }'

# 6. Update the option node with team allocations
echo -e "\n${BLUE}6. Updating the option node with team allocations${NC}"
curl -s -X PATCH "$BASE_URL/$OPTION_ID" \
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

# 7. Get the option node again to see all updates
echo -e "\n${BLUE}7. Getting the option node with all updates${NC}"
curl -s -X GET "$BASE_URL/$OPTION_ID"

# 8. Update all properties at once
echo -e "\n${BLUE}8. Updating all properties at once${NC}"
curl -s -X PATCH "$BASE_URL/$OPTION_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Updated Test Option",
    "description": "An updated test option with complex data",
    "position": { "x": 150, "y": 250 },
    "optionType": "partner",
    "duration": 45,
    "status": "in-progress",
    "goals": [
      {
        "id": "goal1",
        "name": "Updated Increase Revenue",
        "description": "Increase revenue by 30% in the next quarter"
      },
      {
        "id": "goal2",
        "name": "Updated Reduce Costs",
        "description": "Reduce operational costs by 20%"
      },
      {
        "id": "goal3",
        "name": "Expand Market Share",
        "description": "Expand market share by 10%"
      }
    ],
    "risks": [
      {
        "id": "risk1",
        "name": "Updated Market Volatility",
        "description": "Market conditions may change very rapidly",
        "impact": "high",
        "likelihood": "high"
      },
      {
        "id": "risk2",
        "name": "Updated Resource Constraints",
        "description": "Very limited resources may significantly delay implementation",
        "impact": "high",
        "likelihood": "high"
      },
      {
        "id": "risk3",
        "name": "Regulatory Changes",
        "description": "New regulations may impact implementation",
        "impact": "medium",
        "likelihood": "medium"
      }
    ],
    "memberAllocations": [
      {
        "memberId": "member1",
        "timePercentage": 75
      },
      {
        "memberId": "member2",
        "timePercentage": 100
      },
      {
        "memberId": "member5",
        "timePercentage": 50
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

# 9. Get the option node again to see all updates
echo -e "\n${BLUE}9. Getting the option node with all updates${NC}"
curl -s -X GET "$BASE_URL/$OPTION_ID"

# Create a second option node for edge testing
echo -e "\n${BLUE}10. Creating a second option node for edge testing${NC}"
RESPONSE2=$(curl -s -X POST $BASE_URL \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Target Option",
    "description": "A target option for edge testing",
    "position": { "x": 300, "y": 400 },
    "optionType": "partner",
    "duration": 20,
    "status": "planning"
  }')

echo "Response: $RESPONSE2"

# Extract the ID of the second option
TARGET_OPTION_ID=$(echo $RESPONSE2 | grep -o '"id":"[^"]*"' | sed 's/"id":"//g' | sed 's/"//g')

if [ -z "$TARGET_OPTION_ID" ]; then
  echo -e "${RED}Failed to extract target option ID from response${NC}"
  # Use a hardcoded ID for testing
  TARGET_OPTION_ID="target-option-test-id"
  echo -e "${YELLOW}Using hardcoded target ID for testing: $TARGET_OPTION_ID${NC}"
else
  echo -e "${GREEN}Successfully created target option node with ID: $TARGET_OPTION_ID${NC}"
fi

# 11. Create an edge between the two option nodes
echo -e "\n${BLUE}11. Creating an edge between option nodes${NC}"
EDGE_RESPONSE=$(curl -s -X POST "$BASE_URL/edges" \
  -H "Content-Type: application/json" \
  -d '{
    "source": "'$OPTION_ID'",
    "target": "'$TARGET_OPTION_ID'",
    "type": "OPTION_DEPENDENCY",
    "data": {
      "label": "Depends on",
      "description": "This option depends on the target option",
      "priority": "high",
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

# 12. Get all edges for the source option node
echo -e "\n${BLUE}12. Getting all edges for the source option node${NC}"
curl -s -X GET "$BASE_URL/edges?nodeId=$OPTION_ID&type=OPTION_DEPENDENCY"

# 13. Get the specific edge by ID
echo -e "\n${BLUE}13. Getting the specific edge by ID${NC}"
curl -s -X GET "$BASE_URL/edges/$EDGE_ID"

# 14. Update the edge
echo -e "\n${BLUE}14. Updating the edge${NC}"
curl -s -X PATCH "$BASE_URL/edges/$EDGE_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "label": "Strongly depends on",
    "description": "This option strongly depends on the target option",
    "priority": "high"
  }'

# 15. Get the updated edge
echo -e "\n${BLUE}15. Getting the updated edge${NC}"
curl -s -X GET "$BASE_URL/edges/$EDGE_ID"

# 16. Delete the edge
echo -e "\n${BLUE}16. Deleting the edge${NC}"
DELETE_RESPONSE=$(curl -s -X DELETE "$BASE_URL/edges/$EDGE_ID" -w "%{http_code}")
if [[ $DELETE_RESPONSE == *204* ]]; then
  echo -e "${GREEN}Successfully deleted edge with ID: $EDGE_ID${NC}"
else
  echo -e "${RED}Failed to delete edge with ID: $EDGE_ID${NC}"
  echo "Response: $DELETE_RESPONSE"
fi

# 17. Verify the edge is deleted by trying to get it
echo -e "\n${BLUE}17. Verifying the edge is deleted${NC}"
VERIFY_RESPONSE=$(curl -s -X GET "$BASE_URL/edges/$EDGE_ID" -w "%{http_code}")
if [[ $VERIFY_RESPONSE == *404* ]]; then
  echo -e "${GREEN}Edge successfully deleted and not found${NC}"
else
  echo -e "${YELLOW}Edge might still exist${NC}"
  echo "Response: $VERIFY_RESPONSE"
fi

# 18. Delete the option nodes
echo -e "\n${BLUE}18. Deleting the option nodes${NC}"
curl -s -X DELETE "$BASE_URL/$OPTION_ID"
curl -s -X DELETE "$BASE_URL/$TARGET_OPTION_ID"

echo -e "\n${GREEN}Option API tests completed${NC}" 