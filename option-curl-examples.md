# Option API Curl Examples

These curl commands can be used to test the Option API endpoints individually.

## Create an Option Node

```bash
curl -X POST http://localhost:3000/api/graph/option \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Option",
    "description": "A test option with complex data",
    "position": { "x": 100, "y": 200 },
    "optionType": "customer",
    "duration": 30,
    "status": "planning"
  }'
```

## Get an Option Node

```bash
curl -X GET http://localhost:3000/api/graph/option/{option_id}
```

Replace `{option_id}` with the actual ID of the option node.

## Update an Option Node with Goals

```bash
curl -X PATCH http://localhost:3000/api/graph/option/{option_id} \
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
```

## Update an Option Node with Risks

```bash
curl -X PATCH http://localhost:3000/api/graph/option/{option_id} \
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
```

## Update an Option Node with Member Allocations

```bash
curl -X PATCH http://localhost:3000/api/graph/option/{option_id} \
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
```

## Update an Option Node with Team Allocations

```bash
curl -X PATCH http://localhost:3000/api/graph/option/{option_id} \
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
```

## Update All Properties at Once

```bash
curl -X PATCH http://localhost:3000/api/graph/option/{option_id} \
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
```

## Delete an Option Node

```bash
curl -X DELETE http://localhost:3000/api/graph/option/{option_id}
``` 