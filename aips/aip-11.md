---
aip: 11
title: Tokens as Objects
author: davidiw, movekevin, lightmark, capcap, kslee8224, neoul
discussions-to: https://github.com/aptos-foundation/AIPs/issues/31
Status: Draft
last-call-end-date (*optional:
type: Standard (Framework)
created: 2023/1/9
updated: 2023/3/18
requires: [AIP-10](Move Objects)
---

# AIP-11 - Tokens as Objects

## Summary

This AIP proposes a new Token standard for Aptos using Move Objects. In this model, a token represents a unique asset of a larger collection of assets. Both the Move object representation of collections and assets embrace the extensibility of the object model to support creating rich applications, such as NFTs, game assets, no-code solutions, while remaining fully interface compatible. This allows for applications that leverage tokens to either specialize on the higher level purpose of the token or to generalize across all tokens, the difference between a specific game publishers token store front and a token marketplace.

## Motivation

Objects provide a natural means to represent tokens with the following features:

- **Globally addressable**. The earlier Aptos token standard allowed tokens to be placed anywhere, which could result in confusing user experiences if a user did not track their tokens carefully.
- **Common state**. Every token shares the same core data model and business logic allowing for general purpose token applications.
- **Extensible**. Tokens expose logic that enable modification to core business logic.
- **Storage efficient**. Each token stores its resources within a resource group, which can be shared by other layers.
- **Composable**. Tokens can own tokens allowing for creators to build rich on-chain applications.
- **Simplified**. Finally, tokens can have well defined properties like soul bound, burning, and freezing that can work seamlessly.

Many of these same properties apply equally to collections.

## Rationale

The existing Token model has two issues: extremely comprehensive and the usage of `store` ability in move. In the attempt to address the limitations of Move prior to objects, the token standard had no choice but to attempt to solve as many foreseeable challenges in the world of tokens and suffer if it did not. This resulted in features like `property_versions` that are poorly understood, the lack of a freeze or soul bound feature, and several other issues. In addition, because the model leverages `store` token data could be placed anywhere on-chain which can result in a lot of user experience issues. This object-based model resolves many of the known issues with the tradeoff that existing infrastructure may need to port to the new model. Though users of indexers and SDKs likely will not notice a difference.

In parallel to this, there is an expectation to continue to manage and support the existing token standard. As well as provide a migration path for existing tokens into this standard. It is also important that the community recognizes the need to be comfortable with regular iterations in the token standard as Move is still a very young language and many features and paradigms are being explored and evaluated.

## Specification

### Object IDs for Tokens and Collections

Because tokens build upon objects, they must adhere to how object ids are generated. Object IDs are generated using the following: `sha3_256(address_of(creator) | seed | 0xFE)` or `sha3_256(GUID | 0xFD)`. Tokens can use the `seed` field to generate unique addresses for each token. Tokens use the following when generating the seed: `bcs::to_bytes(collection) | b"::" | bcs::to_bytes(name)` and also support generating ObjectIds by GUID. Similarly collections use the following when generating a seed `bcs::to_bytes(collection)`. This ensures global uniqueness for all collections and tokens, except in the case that a token or collection has been burned. Note, `0xFE` was chosen to provide domain separation and ensure that address generation is unique to prevent duplicate address generation between objects and accounts.

The current iteration of tokens does not leverage the `GUID`-based Object ID generation due to challenges with discoverability. Specifically, once Aptos has sufficient on-node indexing to identify `GUID`-based objects another standard will follow.

### Core Logic

The token standard consists of tokens, collections, and royalties.

#### Tokens

A token cannot be created without a there first existing a collection.

The creator of a collection is the only entity capable of adding a token to that collection.

A token exposes `ref`s that allow for mutation of token fields and the ability to burn the token.

It makes no changes to the underlying extensibility of a Move object.

#### Collections

Collections support supply tracking. Currently, a collection may use either `FixedSupply` tracker or `UnlimitedSupply`. Both the `FixedSupply` and `UnlimitedSupply` track all mints along with burn and mint events. In addition, `FixedSupply` specifies a maximum number of tokens associated with a collection. Not using a tracker allows for parallelism at the sacrifice of specifying the maximum number of tokens or giving each token a unique index into the collection.

A collection exposes a mutation `ref`s that allow for mutation of collection fields.

It makes no changes to the underlying extensibility of a Move object.

#### Royalties

Royalties specify a means to dictate an entity to receive a partial amount of payment in a sale.

Using the extensible model, a royalty can exist either at the collection-level or a token-level. If it is defined at both, the interfaces will prefer the token-level royalty.

Royalties expose a mutation `ref` that allows for creating and updating a royalty associated with either a collection or token.

It makes no changes to the underlying extensibility of a Move object.

### Data Structures

This standard specifies data structures for tokens, collections, and royalties.

### Token Data Structures

```move
#[resource_group_member(group = aptos_framework::object::ObjectGroup)]
/// Represents the common fields to all tokens.
struct Token has key {
    /// The collection from which this token resides.
    collection: Object<Collection>,
    /// Unique identifier within the collection, optional, 0 means unassigned
    collection_id: u64,
    /// A brief description of the token.
    description: String,
    /// The name of the token, which should be unique within the collection; the length of name
    /// should be smaller than 128, characters, eg: "Aptos Animal #1234"
    name: String,
    /// The creation name of the token. Since tokens are created with the name as part of the
    /// The Uniform Resource Identifier (uri) pointing to the JSON file stored in off-chain
    /// storage.
    uri: String,
    /// Emitted upon any mutation of the token.
    mutation_events: event::EventHandle<MutationEvent>,
}

/// This enables burning an NFT, if possible, it will also delete the object. Note, the data
/// in inner and self occupies 32-bytes each, rather than have both, this data structure makes
/// a small optimization to support either and take a fixed amount of 34-bytes.
struct BurnRef has drop, store {
    inner: Option<object::DeleteRef>,
    self: Option<address>,
}

/// This enables mutating descritpion and URI by higher level services.
struct MutatorRef has drop, store {
    self: address,
}

/// Contains the mutated fields name. This makes the life of indexers easier, so that they can
/// directly understand the behavior in a writeset.
struct MutationEvent has drop, store {
    mutated_field_name: String,
}
```

#### Collection Data Structures

```move
#[resource_group_member(group = aptos_framework::object::ObjectGroup)]
/// Represents the common fields for a collection.
struct Collection has key {
    /// The creator of this collection.
    creator: address,
    /// A brief description of the collection.
    description: String,
    /// An optional categorization of similar token.
    name: String,
    /// The Uniform Resource Identifier (uri) pointing to the JSON file stored in off-chain
    /// storage; the URL length will likely need a maximum any suggestions?
    uri: String,
    /// Emitted upon any mutation of the collection.
    mutation_events: event::EventHandle<MutationEvent>,
}

/// This enables mutating description and URI by higher level services.
struct MutatorRef has drop, store {
    self: address,
}

/// Contains the mutated fields name. This makes the life of indexers easier, so that they can
/// directly understand the behavior in a writeset.
struct MutationEvent has drop, store {
    mutated_field_name: String,
}

#[resource_group_member(group = aptos_framework::object::ObjectGroup)]
/// Fixed supply tracker, this is useful for ensuring that a limited number of tokens are minted.
/// and adding events and supply tracking to a collection.
struct FixedSupply has key {
    /// Total minted - total burned
    current_supply: u64,
    max_supply: u64,
    total_minted: u64,
    /// Emitted upon burning a Token.
    burn_events: event::EventHandle<BurnEvent>,
    /// Emitted upon minting an Token.
    mint_events: event::EventHandle<MintEvent>,
}

#[resource_group_member(group = aptos_framework::object::ObjectGroup)]
/// Unlimited supply tracker, this is useful for adding events and supply tracking to a collection.
struct UnlimitedSupply has key {
    current_supply: u64,
    total_minted: u64,
    /// Emitted upon burning a Token.
    burn_events: event::EventHandle<BurnEvent>,
    /// Emitted upon minting an Token.
    mint_events: event::EventHandle<MintEvent>,
}
```

### Data Limits

To ensure access to the data stored on-chain, for example, during indexing or querying APIs, the standard employs several limits to fields with dynamic length:

* Description fields can contain up to 2048 characters.
* Name fields can contain up to 128 characters.
* URI fields can contain up to 512 characters.

#### Royalty Data Structures

```move
#[resource_group_member(group = aptos_framework::object::ObjectGroup)]
/// The royalty of a token within this collection -- this optional
struct Royalty has copy, drop, key {
    numerator: u64,
    denominator: u64,
    /// The recipient of royalty payments. See the `shared_account` for how to handle multiple
    /// creators.
    payee_address: address,
}

/// This enables creating or overwriting a MutatorRef.
struct MutatorRef has drop, store {
    inner: ExtendRef,
}
```

### APIs

The standard contains all viable APIs for accessing, mutating, and deleting tokens, collections, and royalties. There are no entry functions as the token standard leaves that to more specific implementations.

#### Token APIs

```move
/// Creates a new token object from a token name and returns the ConstructorRef for
/// additional specialization.
public fun create_named_token(
    creator: &signer,
    collection_name: String,
    description: String,
    name: String,
    royalty: Option<Royalty>,
    uri: String,
): ConstructorRef;

/// Creates a new token object from an account GUID and returns the ConstructorRef for
/// additional specialization.
public fun create_from_account(
    creator: &signer,
    collection_name: String,
    description: String,
    name: String,
    royalty: Option<Royalty>,
    uri: String,
): ConstructorRef;

/// Generates the collections address based upon the creators address and the collection's name
public fun create_token_address(creator: &address, collection: &String, name: &String): address;

/// Named objects are derived from a seed, the collection's seed is its name.
public fun create_token_seed(collection: &String, name: &String): vector<u8>;

/// Creates a MutatorRef, which gates the ability to mutate any fields that support mutation.
public fun generate_mutator_ref(ref: &ConstructorRef): MutatorRef;

/// Creates a BurnRef, which gates the ability to burn the given token.
public fun generate_burn_ref(ref: &ConstructorRef): BurnRef;

/// Extracts the tokens address from a BurnRef.
public fun address_from_burn_ref(ref: &BurnRef): address;

public fun creator<T: key>(token: Object<T>): address;

public fun collection<T: key>(token: Object<T>): String;

public fun collection_object<T: key>(token: Object<T>): Object<Collection>;

public fun description<T: key>(token: Object<T>): String;

public fun name<T: key>(token: Object<T>): String;

public fun uri<T: key>(token: Object<T>): String;

public fun royalty<T: key>(token: Object<T>): Option<Royalty>;

public fun burn(burn_ref: BurnRef);

public fun set_description(mutator_ref: &MutatorRef, description: String);

public fun set_name(mutator_ref: &MutatorRef, name: String);

public fun set_uri(mutator_ref: &MutatorRef, uri: String);
```

#### Collections APIs

```
/// Creates a fixed-sized collection, or a collection that supports a fixed amount of tokens.
/// This is useful to create a guaranteed, limited supply on-chain digital asset. For example,
/// a collection 1111 vicious vipers. Note, creating restrictions such as upward limits results
/// in data structures that prevent Aptos from parallelizing mints of this collection type.
public fun create_fixed_collection(
    creator: &signer,
    description: String,
    max_supply: u64,
    name: String,
    royalty: Option<Royalty>,
    uri: String,
): ConstructorRef;

/// Creates an unlimited collection. This has support for supply tracking but does not limit
/// the supply of tokens.
public fun create_unlimited_collection(
    creator: &signer,
    description: String,
    name: String,
    royalty: Option<Royalty>,
    uri: String,
): ConstructorRef;

public fun create_collection_address(creator: &address, name: &String): address;

/// Named objects are derived from a seed, the collection's seed is its name.
public fun create_collection_seed(name: &String): vector<u8>;

/// Creates a MutatorRef, which gates the ability to mutate any fields that support mutation.
public fun generate_mutator_ref(ref: &ConstructorRef): MutatorRef;

public fun count<T: key>(collection: Object<T>): Option<u64> acquires FixedSupply;

public fun creator<T: key>(collection: Object<T>): address;

public fun description<T: key>(collection: Object<T>): String;

public fun name<T: key>(collection: Object<T>): String;

public fun uri<T: key>(collection: Object<T>): String;

public fun set_description(mutator_ref: &MutatorRef description: String);

public fun set_uri(mutator_ref: &MutatorRef, uri: String);
```

### Royalty APIs

```
/// Add a royalty, given a ConstructorRef.
public fun init(ref: &ConstructorRef, royalty: Royalty);

/// Set the royalty if it does not exist, replace it otherwise.
public fun update(mutator_ref: &MutatorRef, royalty: Royalty);

public fun create(numerator: u64, denominator: u64, payee_address: address): Royalty;

public fun generate_mutator_ref(ref: ExtendRef): MutatorRef;

public fun exists_at(addr: address): bool;

public fun get<T: key>(maybe_royalty: Object<T>): Option<Royalty>;

public fun denominator(royalty: &Royalty): u64;

public fun numerator(royalty: &Royalty): u64;

public fun payee_address(royalty: &Royalty): address;
```

## Reference Implementation

The first commit in https://github.com/aptos-labs/aptos-core/pull/7277

## Risks and Drawbacks

Iterating quickly in the token space can cause negative impact for builders that likely want stability. It is paramount that we recognize the right frequency and motivation for iterating. We also do not want to limit the potential of what can be built due to this tension.

## Future Potential

Tokens as objects allows for much richer expression and decouples core token code from applications of tokens. There likely will be very limited changes to the core token code after this point in time as new applications produce their own code that sits on top of the core token module.

## Suggested implementation timeline

- An exploratory version has lived within `move-examples` since January of 2023.
- General alignment on the framework achieved by middle of March 2023.
- Mainnet by middle May 2023 -- Release 1.4.
