---
aip: 43
title: Parallelize Digital Assets (Token V2) minting/burning
author: <a list of the author's or authors' name(s) and/or username(s), or name(s) and email(s). Details are below.>
discussions-to (*optional): https://github.com/aptos-foundation/AIPs/issues/209
Status: Draft
last-call-end-date (*optional): <mm/dd/yyyy the last date to leave feedbacks and reviews>
type: Standard (Framework)
created: <mm/dd/yyyy>
updated (*optional): <mm/dd/yyyy>
requires (*optional): <AIP number(s)>
---

# AIP-43 - Digital Assets (Token V2 Throughput Improvement)
  
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
- parallelize event creation. Either use Aggregators for counter in the event.move, or remove sequence number from events altogether 

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

Describe how long you expect the implementation effort to take, perhaps splitting it up into stages or milestones.
  
### Suggested developer platform support timeline

Describe the plan to have SDK, API, CLI, Indexer support for this feature is applicable. 

### Suggested deployment timeline

When should community expect to see this deployed on devnet?

On testnet?

On mainnet?

## Security Considerations

Has this change being audited by any auditing firm? 
Any potential scams? What are the mitigation strategies?
Any security implications/considerations?
Any security design docs or auditing materials that can be shared?

## Testing (optional)

What is the testing plan? How is this being tested?

