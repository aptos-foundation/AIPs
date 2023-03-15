---
aip: 11
title: Tokens as Objects
author: davidiw
discussions-to: https://github.com/aptos-foundation/AIPs/issues/31
Status: Draft
last-call-end-date (*optional:
type: Standard (Framework)
created: 2023/1/9
updated:
requires: [AIP-10](Move Objects)
---

# AIP-11 - Tokens as Objects

## Summary

This AIP proposes a new Token standard using Move Objects. In this model, a token only represents the base concept of a token and is used as a building block for applications of tokens, such as NFTs, game assets, no code solutions, etc.

## Motivation

Objects provide a natural means to represent tokens:

- Tokens should ideally be globally addressable, objects are.
- Every token has a common set of state, which can be represented by a `Token` resource within the resource group: `ObjectGroup`.
- Tokens can have actions performed on them independent of the creator, objects can directly emit events.
- Easier composability and extensibility, specifically token behavior and attributes should not be limited by the standard but by the imagination of their creator, the framework for creating objects allows for this.
- Objects make it easier to define properties like soul bound tokens and ensuring burning can happen. Soul bound tokens simply disable transferring. Similarly, a globally defined token can easily be burned or marked as having violated royalties.

## Rationale

The existing Token model attempts to be extremely comprehensive, because the data model for Aptos prior to objects was rather rigid in that Move structs cannot be modified after publishing the module and adding new resources is considered expensive. With the advent of objects and resource groups, these assertions can be challenged and we can provide new paradigms that are just as cost-efficient but much more expressive, which in turn can lead to a better developer experience.

In parallel to this, there is an expectation to continue to manage and support the existing token standard. As well as provide a migration path for existing tokens into this standard. It is also important that the community recognizes the need to be comfortable with regular iterations in the token standard as Move is still a very young language and many features and paradigms are being explored and evaluated.

## Specification

### Object IDs for Tokens and Collections

Because tokens build upon objects, they must adhere to how object ids are generated. Object IDs are generated using the following: `sha3_256(address_of(creator) | seed | 0xFE)`. Tokens can use the `seed` field to generate unique addresses for each token. Tokens use the following when generating the seed: `bcs::to_bytes(collection) | b"::" | bcs::to_bytes(name)`. Similarly tokens use the following when generating a seed `bcs::to_bytes(collection)`. This ensures global uniqueness for all collections and tokens, except in the case that a token or collection has been burned. Note, `0xFE` was chosen to provide domain separation and ensure that address generation is unique to prevent duplicate address generation between objects and accounts.

### Token Data Structures

```move
#[resource_group(container = aptos_framework::object::ObjectGroup)]
/// Represents the common fields to all tokens.
struct Token has key {
    /// An optional categorization of similar token.
    collection: String,
    /// The creator of this token.
    creator: address,
    /// A brief description of the token.
    description: String,
    /// The name of the token, which should be unique within the collection; the length of name
    ///should be smaller than 128, characters, eg: "Aptos Animal #1234"
    name: String,
    /// Since the name may be mutable, this allows for accessing the original name at the time
    /// of creation, which allows for computing the address of the token.
    creation_name: Option<String>,
    /// The Uniform Resource Identifier (uri) pointing to the JSON file stored in off-chain
    /// storage; the URL length will likely need a maximum any suggestions?
    uri: String,
}
```

### Collection Data Structures

```move
#[resource_group(container = aptos_framework::object::ObjectGroup)]
/// Represents the common fields for a collection.
struct Collection has key {
    /// An optional categorization of similar token.
    collection: String,
    /// The creator of this collection.
    creator: address,
    /// A brief description of the collection.
    description: String,
    /// The Uniform Resource Identifier (uri) pointing to the JSON file stored in off-chain
    /// storage; the URL length will likely need a maximum any suggestions?
    uri: String,
}

#[resource_group(container = aptos_framework::object::ObjectGroup)]
/// This config specifies mutable fields for collections
struct Collection::MutabilityConfig has key {
    description: bool,
    uri: bool,
}

#[resource_group(container = aptos_framework::object::ObjectGroup)]
/// This config specifies mutable fields for Tokens in this collection
struct Collection::MutabilityConfig has key {
    description: bool,
    name: bool,
    uri: bool,
}

#[resource_group(container = aptos_framework::object::ObjectGroup)]
/// The royalty of a token in this collection
struct Royalty has key {
    numerator: u64,
    denominator: u64,
    /// The recipient of royalty payments. See the `shared_account` for how to handle multiple
    /// creators.
    payee_address: address,
}

#[resource_group(container = aptos_framework::object::ObjectGroup)]
/// Aggregable supply tracker, this is can be used for maximum parallel minting but only for
/// for uncapped mints.
struct AggregableSupply has key {
    current_supply: Aggregator,
}

#[resource_group(container = aptos_framework::object::ObjectGroup)]
/// Fixed supply tracker, this is useful for ensuring that a limited number of tokens are minted.
struct FixedSupply has key {
    current_supply: u64,
    max_supply: u64,
}
```

### Token APIs

```move
public fun create_fixed_collection(
    creator: &signer,
    collection: String,
    description: String,
    max_supply: u64,
    mutability_config: Collection::MutabilityConfig,
    royalty: Option<Royalty>,
    uri: String,
): CreatorAbility;

public fun create_aggregable_collection(
    creator: &signer,
    collection: String,
    description: String,
    mutability_config: Collection::MutabilityConfig,
    royalty: Option<Royalty>,
    uri: String,
): CreatorAbility;

public fun create_token(
    creator: &signer,
    collection: String,
    description: String,
    mutability_config: Token::MutabilityConfig,
    name: String,
    royalty: Option<Royalty>,
    uri: String,
): CreatorAbility;
```

The standard will contain all viable APIs for mutating the token, deleting tokens, and accessing data associated with tokens. There are no entry functions as the token standard leaves that to more specific implementations.

## Reference Implementation

The second commit in https://github.com/aptos-labs/aptos-core/pull/5976

## Risks and Drawbacks

Iterating quickly in the token space can cause negative impact for builders that likely want stability. It is paramount that we recognize the right frequency and motivation for iterating. We also do not want to limit the potential of what can be built due to this tension.

## Future Potential

Tokens as objects allows for much richer expression and decouples core token code from applications of tokens. There likely will be very limited changes to the core token code after this point in time as new applications produce their own code that sits on top of the core token module. 

## Suggested implementation timeline

- A trivial implementation could be on Devnet by middle of January
- Assuming generally positive feedback, this could progress to the February Testnet cut
- If that goes well, it could be on Mainnet by March
