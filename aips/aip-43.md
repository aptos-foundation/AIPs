---
aip: 43
title: Parallelize Digital Assets (Token V2) minting/burning
author: igor-aptos (https://github.com/igor-aptos), vusirikala (https://github.com/vusirikala)
discussions-to (*optional): https://github.com/aptos-foundation/AIPs/issues/209
Status: In Review
last-call-end-date (*optional): <mm/dd/yyyy the last date to leave feedbacks and reviews>
type: Standard (Framework)
created: 07/20/2023
updated (*optional): <mm/dd/yyyy>
requires (*optional): AIP-47, AIP-44
---

# AIP-43 - Parallelize Digital Assets (Token V2) minting/burning
  
## Summary

Change Token V2 minting and burning to be parallelizable during execution, allowing higher throughput/peak for minting from an individual collection.

## Motivation

Currently, Token V2 minting and burning within a single collection is single-threaded, 
because those operations do read-modify-write on multiple per-collection fields - 
current_supply, total_supply and sequence number in the event handles. 
That translates into minting from a single collection having 5-8x 
lower throughput than minting from multiple collections simultaneously. 

Goal is to remove/optimize operations that make Token V2 operations sequential 

## Impact

This will enable higher throughput for Token V2 NFT minting/burning of a single collection, providing better experience when there is high demand for a single collection.

## Specification

AIP 36 removed one serialization point. We can remove the rest with:
- using Aggregators for total_supply and current_supply counters in the collection.move
- parallelize event creation. Either use Aggregators for counter in the event.move, or use module events that remove sequence number altogether 

## Rationale

Alternative would be to stop tracking supply/giving indices, but that wouldn't work for NFT collections that require limited supply.
We could use a sharded counter (i.e. split the supply into 10 separate counters), to enforce limited supply, but NFTs wouldn't get monotonic indices (i.e. a later mint can get an earlier index). ( [Prototype implementation](https://github.com/aptos-labs/aptos-core/compare/main...igor-aptos:aptos-core:igor/bucketed_counter) )

Alternatively, we could change NFT minting to first require getting a coupon (index in line), 
and then be able to mint with that coupon in a separate transaction, reducing the scope of what is sequential. 
But that is much harder to use in smart contracts, and requries submitting 2 transactions to mint an NFT

## Reference Implementation

- [Draft change](https://github.com/aptos-labs/aptos-core/compare/main...igor-aptos:aptos-core:igor/use_aggregators_for_event_seq_num) to enable event creation to be parallel. Unnecessary after [AIP-44](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-44.md)
- [Draft change](https://github.com/igor-aptos/aptos-core/compare/igor/use_aggregators_for_event_seq_num...igor-aptos:aptos-core:igor/token_v2_using_aggregators) to token v2 to use aggregators and concurrent events. 

## Risks and Drawbacks

Express here the potential negative ramifications of taking on this proposal. What are the hazards?

## Future Potential

Think through the evolution of this proposal well into the future. How do you see this playing out? What would this proposal result in in one year? In five years?

## Timeline

### Suggested implementation timeline

Implementation of this AIP will be close to the drafts linked, and is simple. Majority of the complexity comes from depenedent AIPs.

### Suggested developer platform support timeline

New structs are being added to Collection and Token, which will need to be indexed and usages updated in order to provide:
- index for concurrent collections (different index field will be set)
- supply for concurrent collections (different resource will contain supply of the collection)

Indexer changes are being designed.

### Suggested deployment timeline

Tentative to be included in v1.8

## Security Considerations

Design has been reviewed within the team, and any PRs will be carefully reviewed as well.
This PR provides equivalent functionality that exists today, in a parallizable way, most security considerations will come from implementations of the dependent AIPs.

## Testing (optional)

Once implemented, and once the dependencies are implemented, testing will include move unit tests for correctness, as well as benchmark evaluation for performance implications.
