---
aip: 70
title: Parallelize Fungible Assets
author: igor-aptos (https://github.com/igor-aptos), vusirikala (https://github.com/vusirikala)
discussions-to (*optional): https://github.com/aptos-foundation/AIPs/issues/209
Status: In Review
last-call-end-date (*optional): <mm/dd/yyyy the last date to leave feedbacks and reviews>
type: Standard (Framework)
created: 07/20/2023
updated (*optional): <mm/dd/yyyy>
requires (*optional): AIP-47, AIP-44
---

# AIP-70 - Parallelize Fungible Assets minting/burning
  
## Summary

This AIP proposes a solution to speedup Fungible Asset operations by parallelizing the processes (single thread to multithread). Currently, Fungible Assets are single threaded and sequential when minting from individual collection or asset, our touching the same balance, by parallelizing this we can expect a higher throughput/peak.

Please note, this AIP introduces a breaking change! Please read the rest of the AIP for details.

## Motivation

Currently, Fungible Asset minting and burning within a Fungible Asset is single-threaded, 
because those operations do read-modify-write on supply field and sequence number in the event handles. 
That translates into minting from a single asset having 5-8x 
lower throughput than minting from multiple asset simultaneously. 

Additionally deposit and withdraw operations do read-modify-write on balance field, making operations on same FungibleAssetStore sequential as well.

Goal is to remove/optimize operations that make Fungible Asset operations sequential 

## Impact

This will enable higher throughput for minting/burning of a single Fungible Asset, for deposit and withdraw of a single FungibleAssetStore, providing better experience when there is high demand for a fungible asset/fungible asset store.

There is a **breaking change** for anyone accessing raw resources - like indexers or directly through the RestAPI.

New variants will be added to:
- Fungible Asset ([fungible_asset.move](https://github.com/aptos-labs/aptos-core/blob/main/aptos-move/framework/aptos-framework/sources/fungible_asset.move)), namely `ConcurrentSupply` (in addition to current `Supply`), which will now store current and total supply. `ConcurrentFungibleBalance` will also be added, to store balance.

New collections will emit new events: `Mint` and `Burn` will be emitted (instead of `MintEvent` and `BurnEvent`) on the new collections. 

Indexer changes will be provided that will read new events, and index them as if they were regular events.

## Specification

## Rationale

## Reference Implementation

- [PR](https://github.com/aptos-labs/aptos-core/pull/9972) to fungible assets supply to use aggregators
- [PR](https://github.com/aptos-labs/aptos-core/pull/11183) to fungible assets balance to use aggregators

## Risks and Drawbacks

Other than needing to be careful with deployment, due to the breaking changes mentioned above, only other nuance is making sure that gas charges for the new flow are comparable to the previous gas charges.

## Future Potential

We will further look into any sequential bottlenecks in the framework, and see if they can be addressed one way, or another.

## Timeline

### Suggested implementation timeline

Implementation of this AIP will be close to the drafts linked, and is simple. Majority of the complexity comes from depenedent AIPs.

### Suggested developer platform support timeline

Indexer changes are being developed

### Suggested deployment timeline

Planned deployment timeline:
- with v1.11 framework and feature flags upgrade, we plan to enable CONCURRENT_FUNGIBLE_ASSETS feature flag, which will:
  - any new Fungible Asset collection will be created to be "concurrent" - using new ConcurrentSupply variant, and providing performance/throughput benefits 
    - new collections will emit ConcurrentMintEvent/ConcurrentBurnEvent. 
  - any old Fungible Asset collection will be able to call upgrade_to_concurrent(&ExtendRef) function, and switch to "concurrent" mode, enabling performance/throughput benefits
  - balance field on concurrent collections will be moved to ConcurrentFungibleBalance.balance.value
  
## Security Considerations

This PR provides equivalent functionality that exists today, in a parallizable way, most security considerations will come from implementations of the dependent AIPs.

This PR touches all FungibleAsssets - including APT, and so any issues within dependent AIPs (i.e. AggregatorsV2) could lead to loss of funds or minting out of thin air, and so this feature needs to be evaluated carefully.
  
## Testing (optional)

Once implemented, and once the dependencies are implemented, testing will include move unit tests for correctness, as well as benchmark evaluation for performance implications.
