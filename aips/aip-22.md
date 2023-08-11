---
aip: 22
title: No-Code Digital Assets (Token Objects)
author: davidiw, movekevin, lightmark, capcap
discussions-to: https://github.com/aptos-foundation/AIPs/issues/31
Status: Accepted
last-call-end-date (*optional:
type: Standard (Framework)
created: 2023/3/18
updated:
requires: [AIP-11](Tokens as Objects)
---

# AIP-22 - No-Code Digital Assets (Token Objects)

## Summary

This AIP proposes a framework around Token Objects that enables developers to create tokens and collections without writing any Move code. It does this by making decisions on business logic, data layout, and providing entry functions.

## Motivation

Most creators on Aptos have leveraged the existing token standard without the need for additional features. As Move allows for interoperability across modules many creators may never need to configure their own token. This enables creators to focus more on off-chain content, while having good flexibility to leverage on-chain data.

This standard takes the following positions:
* The creator dictates all functionality at creation time. This includes allowing mutations to the collection, royalties, and tokens even after creation.
* The creator is the only entity eligible to make mutations. If users need to make modifications, this can be addressed by leveraging resource accounts as creators and having the signer capability guarded by appropriate business logic.
* Support for burning and freezing tokens, but it must be specified at creation time of the collection.
* Tokens can be created as soul bound.
* Royalties and mutable field definitions are specified at the collection level.
* The default royalty sets the creator as the payee.
* Public functions to read and mutate state.
* Entry functions to mutate state.
* View functions to read state.
* A property map for storing data associated with a token, limited to the Move primitives, `vector<u8>`, and `0x1::string::String`.

Features in the original token standard not found in this standard:
* **Fungibility**. This is a feature rarely used in Aptos for tokens and results in substantial complexity in the code.
* **Semi-fungiblity**. This depends on fungibility, this has yet to be used in practice.
* **Explicit typing in property map**. The current property map does not enforce typing and lacks validation on inputs, as a result, many entities have produced their own framework for reading and writing into the property map resulting in inconsistent experiences.

## Rationale

This is intended to be a first attempt at defining no-code solutions. The object model allows for new no-code solutions to be created without resulting in any discernable difference to the users, except for those seeking the new features. In fact, the solutions can live in parallel. For example, if fungibility or semi-fungibility becomes important, a new no-code solution on fungibility should be proposed and adopted into the Aptos framework.

The alternative is to not place it in the framework and to make an immutable contract. The greatest concern in that space is the potential risk for bugs or for additional functionality that may be desirable in this variant of no-code tokens.

## Specification

The no-code solution consists of three components:

1. *AptosCollection* - a wrapper around collections.
2. *AptosToken* - a wrapper around tokens.
3. *PropertyMap* - generic metadata support for tokens.

### AptosCollection

At the time of creation, AptosCollection is initialized with the following:
* Determine the mutability of collection fields (description and URI).
* Specify the royalty for the entire collection.
* Determine the mutability of all token fields (description, name, and URI).
* Determine if tokens are freezable or burnable.
* Allow for token properties to be created or mutated after generation.

The AptosCollection leverages the `FixedSupply` and limits the number of tokens that may be created. This is not flexible and cannot be adjusted afterward.

### AptosToken

The collection layer makes most of the decisions for AptosToken. During token generation, the framework reviews AptosCollection to appropriately acquire `ref`s from the token for use later, this includes mutation, burn, and transfer `ref`s.

### PropertyMap

The PropertyMap is derived from the original token standard's property map with the caveat about validation. Prior to writing any field into the property map, it must have a valid type and conform to that type. Users can leverage this property map like the earlier property map with the caveat that the type will be required to be string.

For efficiency purposes, property map stores the types for a given value as a `u8`.

### Data Structures

#### AptosCollection Data Structure

```move
#[resource_group_member(group = aptos_framework::object::ObjectGroup)]
/// Storage state for managing the no-code Collection.
struct AptosCollection has key {
    /// Used to mutate collection fields
    mutator_ref: Option<collection::MutatorRef>,
    /// Used to mutate royalties
    royalty_mutator_ref: Option<royalty::MutatorRef>,
    /// Determines if the creator can mutate the collection's description
    mutable_description: bool,
    /// Determines if the creator can mutate the collection's uri
    mutable_uri: bool,
    /// Determines if the creator can mutate token descriptions
    mutable_token_description: bool,
    /// Determines if the creator can mutate token names
    mutable_token_name: bool,
    /// Determines if the creator can mutate token properties
    mutable_token_properties: bool,
    /// Determines if the creator can mutate token uris
    mutable_token_uri: bool,
    /// Determines if the creator can burn tokens
    tokens_burnable_by_creator: bool,
    /// Determines if the creator can freeze tokens
    tokens_freezable_by_creator: bool,
}
```

#### AptosToken Data Structure

```move
#[resource_group_member(group = aptos_framework::object::ObjectGroup)]
/// Storage state for managing the no-code Token.
struct AptosToken has key {
    /// Used to burn.
    burn_ref: Option<token::BurnRef>,
    /// Used to control freeze.
    transfer_ref: Option<object::TransferRef>,
    /// Used to mutate fields
    mutator_ref: Option<token::MutatorRef>,
    /// Used to mutate properties
    property_mutator_ref: Option<property_map::MutatorRef>,
}
```

#### PropertyMap Data Structure

```move
/// PropertyMap provides generic metadata support for AptosToken. It is a  specialization of
/// SimpleMap that enforces strict typing with minimal storage use by using constant u64 to
/// represent types and storing values in bcs format.
#[resource_group_member(group = aptos_framework::object::ObjectGroup)]
struct PropertyMap has key {
    inner: SimpleMap<String, PropertyValue>,
}

struct PropertyValue has drop, store {
    type: u8,
    value: vector<u8>,
}

struct MutatorRef has drop, store {
    self: address,
}

// PropertyValue::type
const BOOL: u8 = 0;
const U8: u8 = 1;
const U16: u8 = 2;
const U32: u8 = 3;
const U64: u8 = 4;
const U128: u8 = 5;
const U256: u8 = 6;
const ADDRESS: u8 = 7;
const BYTE_VECTOR: u8 = 8;
const STRING: u8 = 9;
```
PropertyMap enforces a maximum number of items, 1000, with a property name length of up to 128 characters. In practice, a PropertyMaps should be kept as small as possible. As the price of storage dictates write costs, loading large data stores during indexing and API queries can result in undesirable delays. An non-empirical recommendation would be to keep the data below 10KB.

### APIs

Due to the vast number of APIs, the contents are left in the reference implementation.

## Reference Implementation

The second commit in https://github.com/aptos-labs/aptos-core/pull/7277

## Risks and Drawbacks

PropertyMap has future utility as it was designed independent of AptosCollection and AptosToken to allow for use in other applications and standards.

Developers and applications need to pay no heed to the data in AptosCollection and AptosToken as all the core data is already stored in the underlying token and collection. If new applications or requirements come from the community, new standards can seamlessly co-exist with these.

There is no obvious risk outside of support associated with no-code solutions.

## Future Potential

It is important to determine whether new features belong in the work associated with standard or in parallel standards.

## Suggested implementation timeline

- An exploratory version has lived within `move-examples` since January of 2023.
- General alignment on the framework achieved by middle of March 2023.
- Mainnet by middle May 2023 -- Release 1.4.
