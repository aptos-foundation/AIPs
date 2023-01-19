---
aip: 2
title: Multiple Token Changes
author: areshand
discussions-to: https://github.com/aptos-foundation/AIPs/issues/2
Status: Review
last-call-end-date (*optional):
type: Standard (framework)
created: 12/7/2022
---

# AIP-2 - Multiple Token Changes

## Summary

This proposal contains the following changes:

1. token CollectionData mutation functions: provide set functions to mutate the TokenData fields based on the token mutability setting.
2. token TokenData metadata mutation functions: provide set functions to mutate the CollectionData fields based on collection mutability setting.
3. A bug fix for collection supply underflow: fix a bug that cause underflow error when burning unlimited collection’s TokenData.
4. Fix the order of events: when minting token, the deposit events enter queue before the mint events. This changes corrects the order to make the token deposit event after the mint event.
5. Make a public entry for transfer with opt-in: provide an entry function to allow transfer token directly when users opt-in direct transfer.
6. Ensure royalty numerator is smaller than denominator: we observe about 0.004% token having a royalty > 100%. This change introduces an assertion to ensure royalty is always smaller or equal to 100%.

## Motivation
Change 1, 2: the motivation is to support CollectionData and TokenData mutation based on the mutability config so that creators can update the fields based on their own application logic to support new product features

Change 3,4: the motivation is fix existing issues to make the token contract works correctly

Change 5: this motivation is to allow the dapp to directly call the function without deploying their own contracts or scripts

Change 6: this is to prevent potential malicious token that could lead to charging a higher fee than the token price.

## Rationale

Change 1, 2 are fulling existing token standard specification without introducing new functionalities

Change 3, 4, 5 and 6 are small fix and straightforward changes.

## Reference Implementation

The PRs of the changes above are listed below:

Change 1, 2:
aptos-labs/aptos-core#5382
aptos-labs/aptos-core#5265
aptos-labs/aptos-core#5017

Change 3: aptos-labs/aptos-core#5096

Change 4: aptos-labs/aptos-core#5499

Change 5: aptos-labs/aptos-core#4930

Change 6: aptos-labs/aptos-core#5444

## Risks and Drawbacks

Change 1, 2 are internally reviewed and undergo auditing to fully vet the risks

Change 3, 4 and 6 are to reduce the identified risks and drawbacks

Change 5 is to improve usability. This change doesn’t introduce new functionality

## Timeline
Reference implementation changes will be deployed in devnet on 11/14 (PST) for ease of testing and providing feedback/discussion.
This AIP will be open for public comments until 11/17.
After discussion, reference implementation changes will be deployed in testnet on 11/17 for testing.