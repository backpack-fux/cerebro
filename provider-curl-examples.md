# Provider API Curl Examples

These curl commands can be used to test the Provider API endpoints individually.

## Create a Provider Node

```bash
curl -X POST http://localhost:3000/api/graph/provider \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Provider",
    "description": "A test provider with complex data",
    "position": { "x": 100, "y": 200 },
    "duration": 30,
    "status": "planning"
  }'
```

## Get a Provider Node

```bash
curl -X GET http://localhost:3000/api/graph/provider/{provider_id}
```

Replace `{provider_id}` with the actual ID of the provider node.

## Update a Provider Node with Costs

```bash
curl -X PATCH http://localhost:3000/api/graph/provider/{provider_id} \
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
```

## Update a Provider Node with DD Items

```bash
curl -X PATCH http://localhost:3000/api/graph/provider/{provider_id} \
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
```

## Update a Provider Node with Team Allocations

```bash
curl -X PATCH http://localhost:3000/api/graph/provider/{provider_id} \
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
curl -X PATCH http://localhost:3000/api/graph/provider/{provider_id} \
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
```

## Delete a Provider Node

```bash
curl -X DELETE http://localhost:3000/api/graph/provider/{provider_id}
``` 