---
aip: TBD
title: Royalty Enforcement
author: areshand
discussions-to: https://github.com/aptos-foundation/AIPs/issues/61
Status: Draft
last-call-end-date (*optional):
type: Standard (framework)
created: 02/03/2023
---

## **Summary**

This document provides our recommendation and alternatives for how royalty enforcement can work on Aptos. We are collecting community feedback on the options presented here so we may decide the best path moving forward together. 

## Motivation

We observed the NFT communities on other chains are divided over the controversial topic of royalty enforcement on marketplaces. We want to ensure the creators’ royalties are respected on Aptos so creators can feel safe and incentivized to continue building on Aptos.

Currently, royalty on Aptos is dependent on our community marketplaces and dapps charging the royalties on behalf of the creators. This creates the opportunity for royalty-free marketplaces to reduce the price by skipping the royalty payments.  

Without the community forming a royalty enforcement standard together, the creators and royalty-required marketplaces are at a competitive disadvantage to royalty-free marketplaces. 

## Rationale

When comparing different options for enforcing royalties, the main considerations are:

- **The strength of the enforcement:** The enforcement should be effective enough to dissuade anyone from purchasing a token without paying royalties.
- **The impact on the future growth of the NFT projects**: The selected approach should not limit the potential of building new and exciting applications.
- **The decentralization of the approach:** The selected approach should be decentralized, agreed upon and executed by the ecosystem instead of any single entity.

## Specification

### Recommended approach

**Detecting NFT Violating Royalty Treatment** 

Aptos may provide an API service that provides information to help creators find all the tokens that violate the royalty. The creator can then use the information to annotate those NFTs and flag them as royalty-violating tokens.

The API service would be built on top of an indexer that scans through the NFT transactions on-chain to look for token trades that do not pay the appropriate royalties to the creator’s royalty account. This indexer can be deployed and run by the community.

**Annotating NFT Violating the Royalty**

We can introduce a new on-chain map **RoyaltyViolation** that records all the NFTs that violate the royalty.  The creator has the authority to set the value in this on-chain map. Anyone can read from the map to check if any token has violated the royalty. 

*Note:  Only NFTs are qualified for this annotation where an NFT has a globally unique token_id.* 

```rust
Struct RoyaltyViolation has key {
	royalty_violation_token: Table<token_id, bool>
}

public bool set_royalty_violated(creator: &signer, token_id: TokenId);
public bool is_royalty_violated(token_id: TokenId);
```

The creator can then use the API service to detect the violating tokens too using their own heuristics. Once the creator knows a token has been traded without paying royalties, they can annotate the token with ‘true’ in RoyaltyViolation table. 

**Enforcement**

The enforcement will be done through Aptos Ecosystem projects. The violating tokens can be identified and restricted from trading and participating in various dapps. There are three main areas where the enforcement can take place.  Any one of these areas can greatly restrict the violating token’s usability.

1. **Token Utility**: The creator can easily check if the token has violated the royalty and stop providing utility or service to these tokens. 
2. **Major Marketplaces**: We can work with major marketplaces to stop listing tokens that have violated the royalty. The trade of these tokens would be limited. 
3. **Other Dapp**s: Any dapps can also adopt their own restriction and stop providing service to holders of violating tokens. 

### Alternatives

We can allow the creators to update a whitelist or blacklist of accounts eligible for token transfer. With these two lists, the NFT can be deposited only to the whitelisted accounts, or the NFT cannot be deposited to the blacklisted accounts. Creators can update these lists when they observe a marketplace or app violating the royalty.

The caveat of this blacklist approach is that the marketplaces can easily switch to a new account frequently without restricting its operation. Creators probably cannot keep up with updating their blacklists at the same pace as the marketplaces. Meanwhile, updating frequently and maintaining a large blacklist will cost lots of gas.

The caveat of the whitelist approach is it greatly restricts the token liquidity and prevents other interesting applications to be built on top of the token. The owner cannot transfer their tokens for normal usage. It also stops other developers from building an interesting application for these tokens as they cannot store these tokens in their own contracts.

## Options comparison

|  | Annotation recommendation | Blacklist Alternative | Whitelist Alternative |
| --- | --- | --- | --- |
| Enforcement strength | Strong | Low | Strong |
| Growth Limitation Risk | Low | Low | High |
| Decentralization | Yes | Yes | Yes |

## FAQ:

**If I notice only some fungible token holders  are violating the royalty, how can I annotate the token as royalty violation?**

You can use the mutate token properties method to turn those specific fungible tokens to NFTs where they will have their unique token_ids. You can then annotate these tokens as royalty-violating tokens.

**As a buyer who does not want to buy any token that could be annotated by creators, what should I do?**

Creators’ desired royalty is recorded on-chain within the token metadata. With our current proposal, you can avoid royalties only by purchasing tokens that have no royalty requirements.