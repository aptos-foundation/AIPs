---
aip: 43
title: Parallelize Digital Assets (Token V2) minting/burning
author: igor-aptos (https://github.com/igor-aptos), vusirikala (https://github.com/vusirikala)
discussions-to (*optional): https://github.com/aptos-foundation/AIPs/issues/209
Status: Accepted
last-call-end-date (*optional): <mm/dd/yyyy the last date to leave feedbacks and reviews>
type: Standard (Framework)
created: 07/20/2023
updated (*optional): <mm/dd/yyyy>
requires (*optional): AIP-47, AIP-44
---

# AIP-43 - Parallelize Digital Assets (Token V2)
  
## Summary

This AIP proposes a solution to speedup minting and burning Token v2 by parallelizing the processes (single thread to multithread). Currently, Token v2 is single threaded and sequential when minting from individual collection or asset, by parallelizing this we can expect a higher throughput/peak.

Please note, this AIP introduces a breaking change! Please read the rest of the AIP for details.

## Motivation

Currently, Token V2 minting and burning within a single collection is single-threaded, 
because those operations do read-modify-write on multiple per-collection fields - 
current_supply, total_supply and sequence number in the event handles. 
That translates into minting from a single collection having 5-8x 
lower throughput than minting from multiple collections simultaneously. 

Goal is to remove/optimize operations that make Token V2 operations sequential 

## Impact

This will enable higher throughput for Token V2 NFT minting/burning of a single collection, providing better experience when there is high demand for a single collection.

There is a **breaking change** for anyone accessing raw resources - like indexers or directly through the RestAPI.
Two fields inside Digital Assets `Token` struct (from [token.move](https://github.com/aptos-labs/aptos-core/blob/main/aptos-move/framework/aptos-token-objects/sources/token.move)) will be deprecated - name and index, and instead `TokenIdentifiers` will contain them. `Token.name` will be replaced with `TokenIdentifiers.name.value`, and similarly for `index` field.

Additionally, new variants will be added to:
- Digital Asset (Token) Collection ([collection.move](https://github.com/aptos-labs/aptos-core/blob/main/aptos-move/framework/aptos-token-objects/sources/collection.move)), namely `ConcurrentSupply` (in addition to current `FixedSupply` and `UnlimitedSupply`), which will now store current, total and max supply

New collections will emit new events: `Mint` and `Burn` will be emitted (instead of `MintEvent` and `BurnEvent`) on the new collections. 

Indexer changes will be provided to return correct values for Token name (i.e. `COALESCE(TokenIdentifiers.name.value, Token.name)`), and supply related fields to both. It will also read new events, and index them as if they were regular events.

## Specification

AIP 36 removed one serialization point. We can remove the rest with:
- using Aggregators for total_supply and current_supply counters in the collection.move
- parallelize event creation, using module events that remove sequence number altogether 

In addition, we will add new API to mint tokens:
```
  public fun create_numbered_token(
        creator: &signer,
        collection_name: String,
        description: String,
        name_with_index_preffix: String,
        name_with_index_suffix: String,
        royalty: Option<Royalty>,
        uri: String,
    ): ConstructorRef {
```
which allows minting of the token, where index is part of the name, while still allowing it to happen concurrently.

## Rationale

Alternative would be to stop tracking supply/giving indices, but that wouldn't work for NFT collections that require limited supply.
We could use a sharded counter (i.e. split the supply into 10 separate counters), to enforce limited supply, but NFTs wouldn't get monotonic indices (i.e. a later mint can get an earlier index). ( [Prototype implementation](https://github.com/aptos-labs/aptos-core/compare/main...igor-aptos:aptos-core:igor/bucketed_counter) )

Alternatively, we could change NFT minting to first require getting a coupon (index in line), 
and then be able to mint with that coupon in a separate transaction, reducing the scope of what is sequential. 
But that is much harder to use in smart contracts, and requries submitting 2 transactions to mint an NFT

## Reference Implementation

- [PR](https://github.com/aptos-labs/aptos-core/pull/9971) to token v2 to use aggregators and module events, including new create_numbered_token method.
- There were a few follow-up PRs with changes and clarifications, all code is gated with CONCURRENT_TOKEN_V2 inside of [collection.move](https://github.com/aptos-labs/aptos-core/blob/main/aptos-move/framework/aptos-token-objects/sources/collection.move) and [token.move](https://github.com/aptos-labs/aptos-core/blob/main/aptos-move/framework/aptos-token-objects/sources/token.move)

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
- with v1.10 framework and feature flags upgrade, new `TokenIdentifiers` (with `name` and `index`) will start to be populated (in addition to current fields)
- few weeks later, CONCURRENT_TOKEN_V2 feature flag will be enabled, and with it:
  - `name` and `index` fields in `Token` struct will be deprecated, and will be empty ("" and 0 respectively) for any new token mint
  - any new Digital Asset collection will be created to be "concurrent" - using new ConcurrentSupply variant, and providing performance/throughput benefits
    - new collections will emit Mint/Burn. 
  - any old Digital Asset collection will be able to call upgrade_to_concurrent(&ExtendRef) function, and switch to "concurrent" mode, enabling performance/throughput benefits
 
## Security Considerations

Design has been reviewed within the team, and any PRs will be carefully reviewed as well.
This PR provides equivalent functionality that exists today, in a parallizable way, most security considerations will come from implementations of the dependent AIPs.

## Testing (optional)

Once implemented, and once the dependencies are implemented, testing will include move unit tests for correctness, as well as benchmark evaluation for performance implications.
