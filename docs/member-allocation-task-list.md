# Member Allocation Standardization Task List

## Overview
This task list outlines the steps to standardize member allocation handling across feature, option, and provider nodes, following the pattern used for duration handling with `useDurationPublishing`.

## Implementation Tasks

### 1. Create Member Allocation Publishing Hook
- [x] Create new file `src/hooks/useMemberAllocationPublishing.ts` 
- [x] Implement core hook functionality with protections against circular updates
- [x] Add debounce for backend API calls
- [x] Add update tracking mechanisms
- [x] Add protection against rapid updates

### 2. Refactor Existing Hooks
- [x] Modify `useResourceAllocation` to use the new publishing hook
- [x] Update `useTeamAllocation` to use standardized patterns
- [x] Refactor `useFeatureNode` to delegate allocation updates to the new hook
- [x] Update `useOptionNode` for consistency
- [x] Update `useProviderNode` for consistency

### 3. Update UI Components
- [x] Refactor `MemberAllocation.tsx` to work with the new publishing pattern
- [x] Ensure proper rendering of allocation values
- [x] Fix slider behavior to correctly display values during and after updates

### 4. Testing
- [ ] Test feature node member allocation
- [ ] Test option node member allocation
- [ ] Test provider node member allocation
- [ ] Verify no circular updates occur
- [ ] Verify persistence works correctly
- [ ] Check for memory leaks
- [x] Fix type compatibility issues between hooks (publishManifestUpdate function) - *Implemented dual API approach with both Promise and cleanup function patterns*

### 5. Documentation
- [x] Update API.md with new hook details
- [x] Add to CHANGELOG.md
- [x] Update ARCHITECTURE.md if needed
- [x] Add inline documentation for the new hook
- [x] Document type compatibility issues and solution for future reference
- [x] Add detailed JSDoc documentation for Feature Node data flow

## Expected Outcomes
- Consistent member allocation handling across all node types
- Elimination of rendering issues with allocation values
- Prevention of circular updates
- Improved maintainability through shared patterns 


{
    "initialUser": {
        "address": {
            "line1": "863 Blazing Star Lane",
            "line2": "string",
            "city": "Chelan",
            "region": "WA",
            "postalCode": "98816",
            "countryCode": "US",
            "country": "United State of America"
        },
        "isTermsOfServiceAccepted": true,
        "id": "nope",
        "firstName": "Devin",
        "lastName": "Elliot",
        "birthDate": "1981-08-15",
        "nationalId": "534063025",
        "countryOfIssue": "US",
        "email": "devin@backpack.network",
        "role": "founder",
        "walletAddress": "nope",
        "ipAddress": "nope",
        "iovationBlackbox": "nope"
    },
    "address": {
        "line1": "1230 121st Place NE",
        "city": "C118",
        "region": "WA",
        "postalCode": "98005",
        "countryCode": "USA",
        "country": "USA"
    },
    "entity": {
        "name": "My Backpack",
        "type": "LLC",
        "description": "Self banking software and services",
        "registrationNumber": "604925789",
        "taxId": "921509414",
        "website": "https://www.backpack.network",
        "expectedSpend": "550000"
    },
    "name": "nope",
    "chainId": "nope",
    "contractAddress": "nope",
    "representatives": [
        {
            "id": "nope",
            "firstName": "Devin",
            "lastName": "Elliot",
            "birthDate": "1981-08-15",
            "nationalId": "534063025",
            "countryOfIssue": "US",
            "email": "devin@backpack.network",
            "address": {
                "line1": "863 Blazing Star Lane",
                "city": "Chelan",
                "region": "WA",
                "postalCode": "98816",
                "countryCode": "USA",
                "country": "USA"
            }
        }
    ],
    "ultimateBeneficialOwners": [
        {
            "id": "nope",
            "firstName": "Devin",
            "lastName": "Elliot",
            "birthDate": "1981-08-15",
            "nationalId": "534063025",
            "countryOfIssue": "US",
            "email": "devin@backpack.network",
            "address": {
                "line1": "863 Blazing Star Lane",
                "city": "Chelan",
                "region": "WA",
                "postalCode": "98816",
                "countryCode": "USA",
                "country": "USA"
            }
        }
    ]
}