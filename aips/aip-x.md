---
aip: 
title: Digital Assets Composability
author: aladeenb
discussions-to:  https://github.com/aptos-foundation/AIPs/pull/278#issue
Status: Draft
last-call-end-date:
type: Standard (Framework)
created: 12/01/2023
updated: 31/01/2024
requires: "AIP-10: Move Objects", "AIP-11: Token Objects", "AIP-21: Fungible Assets", "AIP-43: Parallelize Digital Assets (Token V2) minting/burning", "AIP-44: Module Events"
---

# AIP-X - Composable Digital Assets standard

## Summary

This AIP puts forward a framework for Token Objects, allowing developers to create composable tokens and collections without the need for writing Move code. It achieves this by handling decisions related to business logic, data layout, and providing entry functions.

## Motivation

Digital asset creators encounter challenges due to the absence of a standardized approach to composability. This results in either manual implementation with restricted customization and potential security risks or overlooking the true advantages of the digital and fungible asset standards.

This standard takes serves as an enhancement to the `aptos-token` framework in addition to the following:

* Collections have symbols.
* Tokens can be created as named or numbered.
* Tokens can hold fungible assets.
* Entry functions to perform composition.
* public functions for extensibility support.
* View functions to read state.
* A two-steps ownership transfer.
* An migartion mechanism to migrate tokens from different standards.
* A property map for storing data associated with a token, limited to the Move primitives, `vector<u8>`, and `0x1::string::String`.
* A support for storing data associated with a token via custom resources.
* Events are emitted with every function executed.

## Rationale

This is intended to be a first attempt at defining no-code solutions for composability. The object model allows for new no-code solutions to be created without resulting in any discernable difference to the users, except for those seeking the new features. In fact, the solutions can live in parallel. For example, if fungibility or semi-fungibility becomes important, a new no-code solution on fungibility should be proposed and adopted into the Aptos framework.

The alternative is to not place it in the framework and to make an immutable contract. The greatest concern in that space is the potential risk for bugs or for additional functionality that may be desirable in this variant of no-code tokens.

## Alternatives

A potential competitor would be `aptos-token`. But it lacks the following features:

|   | aptos-token | studio
| -- | -- | --
| Freezing/unfreezing transfers | ✅ | ✅
| Creator management functionality | ✅ | ✅
| Custom metadata (via PropertyMap) | ✅ | ✅
| Custom metadata (via Resources) | ❌ | ✅
| Embedded composability | ❌ | ✅
| Embedded migration | ❌ | ✅
| Indexed digital assets mint | ❌ | ✅
| two-step ownership transfer | ❌ | ✅
| Events emitted | ❌ | ✅

Additionally, `aptos-token` poses a security risk by allowing creators to mutate `uri`, enabling the alteration of a token's `uri` to falsely claim ownership of a different digital asset.

Moreover, `aptos-token` lacks storage for `ExtendRef` and returns the Object instead of the `ConstructorRef` of the wrapper object upon creation, preventing the addition of new resources after its initialization.

## Specification

### Overview

The no-code solution consists of three components:

1. *Collection* - a wrapper around collections.
2. *DA* - a wrapper that serves as metadata for traits and composability, storing the list of fungible assets it holds.
3. *Trait* - a wrapper acting as metadata for composability, storing the list of digital and fungible assets it holds.
4. *Composable* - a token wrapper storing lists of traits, digital assets, and fungible assets it holds.

### Core Logic

The framework consists of collections, tokens, and a composition mechanism

#### Collections

Collections can have symbols, and support supply tracking.

#### Tokens

There are three subtypes of tokens, and they will serve as layers to the overall token structure.

Each token will have its reference wrapped within the main wrapper to allow for a successful token composition without breaking the rules of the contract.

##### DAs

digital assets are native tokens from the object token standard. Currently, a digital asset can hold fungible assets

##### Traits

traits can hold a list of DAs and fungible assets

##### Composables

Composables can hold a list of traits, a list of digital_assets and fungible assets

Overall, a visual represenation can look something like this:

![Alt text](image.png)

#### Composition

The mechanism of composing and decomposing is embedded within the module, so creators won't need to worry about writing the code for that.

A composition will involve transfering the token to compose to the token to-compose-to, disables its transfer ability so it won't violate the composition rule, and ultimately update the `uri` of the token to-compose-to

### Data Structure

This standard specifies data strucutes for token subtypes, and collection.

#### Collection Data Structure

```move
#[resource_group_member(group = aptos_framework::object::ObjectGroup)]
    // Storage state for collections
    struct Collection has key {
        // Name of the collection
        name: String,
        // Symbol of the collection
        symbol: String,
        // Supply type of the collection; can be fixed, unlimited or concurrent
        supply_type: String,
        // Used to mutate collection fields
        mutator_ref: Option<collection::MutatorRef>,
        // Used to mutate royalties
        royalty_mutator_ref: Option<royalty::MutatorRef>,
        // Determines if the creator can mutate the collection's description
        mutable_description: bool,
        // Determines if the creator can mutate the collection's uri
        mutable_uri: bool,
        // Determines if the creator can mutate token descriptions
        mutable_token_description: bool,
        // Determines if the creator can mutate token names
        mutable_token_name: bool,
        // Determines if the creator can mutate token properties
        mutable_token_properties: bool,
        // Determines if the creator can mutate token uris
        mutable_token_uri: bool,
        // Determines if the creator can burn tokens
        tokens_burnable_by_creator: bool,
        // Determines if the creator can freeze tokens
        tokens_freezable_by_creator: bool
    }
```

#### DAs Data Structure

```move
#[resource_group_member(group = aptos_framework::object::ObjectGroup)]
    // Storage state for digital assets
    struct DigitalAsset has key {
        // Storage state for the property map
        property_map: property_map::PropertyMap,
        // Storage state for the token
        token: Object<Token>,
        // Storage state for the fungible assets
        fungible_assets: vector<Object<FungibleAsset>>
    }
```

#### Traits Data Structure

```move
#[resource_group_member(group = aptos_framework::object::ObjectGroup)]
// Storage state for traits
struct Trait has key {
    index: u64, // index of the trait in the traits vector from composables
    digital_assets: vector<Object<DA>> // digital assets that the trait holds
}
```

#### Composables Data Structure

```move
#[resource_group_member(group = aptos_framework::object::ObjectGroup)]
// Storage state for composables; aka, the atom/primary of the token
struct Composable has key {
    traits: vector<Object<Trait>>,
    digital_assets: vector<Object<DA>>
}
```

#### Token subtypes common Data Structure

```move
#[resource_group_member(group = aptos_framework::object::ObjectGroup)]
    // Storage state for token references, sticked to the token object
    struct References has key {
        burn_ref: Option<token::BurnRef>,
        extend_ref: object::ExtendRef,
        mutator_ref: Option<token::MutatorRef>,
        transfer_ref: object::TransferRef,
        property_mutator_ref: property_map::MutatorRef
    }
```

#### Misc Data Structures

```move
// Used to determine the naming style of the token
    struct Indexed has key {}
    struct Named has key {}
```

### APIs

The standard contains all viable APIs for accessing, transferring, composing, mutating, deleting tokens, and managing collections, and royalties. There are no entry functions as the composability standard leaves that to more specific implementations.

#### Collection APIs

```move
// Create a collection; 
// this will create a collection resource, a collection object, 
// and returns the constructor reference of the collection.
public fun create_collection<SupplyType: key>(
    signer_ref: &signer,
    description: String,
    max_supply: Option<u64>, // if the collection is set to haved a fixed supply.
    name: String,
    symbol: String,
    uri: String,   
    mutable_description: bool,
    mutable_royalty: bool,
    mutable_uri: bool,
    mutable_token_description: bool,
    mutable_token_name: bool,
    mutable_token_properties: bool,
    mutable_token_uri: bool,
    tokens_burnable_by_creator: bool,
    tokens_freezable_by_creator: bool,
    royalty_numerator: Option<u64>,
    royalty_denominator: Option<u64>
): object::ConstructorRef
```

```move
public fun is_mutable_collection_description<T: key>(collection: Object<T>): bool
```

```move
public fun is_mutable_collection_royalty<T: key>(collection: Object<T>): bool
```

```move
public fun is_mutable_collection_uri<T: key>(collection: Object<T>): bool
```

```move
public fun is_mutable_collection_token_description<T: key>(collection: Object<T>): bool
```

```move
public fun is_mutable_collection_token_name<T: key>(collection: Object<T>): bool
```

```move
public fun is_mutable_collection_token_uri<T: key>(collection: Object<T>): bool
```

```move
public fun is_mutable_collection_token_properties<T: key>(collection: Object<T>): bool
```

```move
public fun are_collection_tokens_burnable<T: key>(collection: Object<T>): bool
```

```move
public fun are_collection_tokens_freezable<T: key>(collection: Object<T>): bool
```

```move
public fun get_collection_name(collection_object: Object<Collection>): String
```

```move
public fun get_collection_symbol(collection_object: Object<Collection>): String
```

```move
public fun get_collection_supply_type(collection_object: Object<Collection>): String
```

#### Token APIs

This section contains APIs for tokens regardless of their type (whether they are composable, trait, or digital asset).

```move
// Create a token based on type. Either a trait or a composable;
// this will create a token resource, a token object,
// and returns the constructor reference of the token.
public fun create_token<Type: key, NamingStyle: key>(
    signer_ref: &signer,
    collection: String,
    description: String,
    name: String,
    name_with_index_prefix: String,
    name_with_index_suffix: String,
    uri: String,
    royalty_numerator: Option<u64>,
    royalty_denominator: Option<u64>,
    property_keys: vector<String>,
    property_types: vector<String>,
    property_values: vector<vector<u8>>
): object::ConstructorRef
```

```move
// Composose a digital asset to a composable
        public fun equip_digital_asset(
            signer_ref: &signer,
            composable_object: Object<Composable>,
            da_object: Object<DA>,
            new_uri: String
        )
```

```move
// equip fa; transfer fa to a token; token can be either composable or trait
public fun equip_fa_to_token<FA: key, Token: key>(
    signer_ref: &signer,
    fa: Object<FA>,
    token_obj: Object<Token>,
    amount: u64
)
```

```move
// unequip fa; transfer fa from a token to the owner
    public fun unequip_fa_from_token<FA: key, Token: key>(
        signer_ref: &signer,
        fa: Object<FA>,
        token_obj: Object<Token>,
        amount: u64
    )
```

```move
// transfer digital assets; from user to user.
public fun transfer_token<Token: key>(
    signer_ref: &signer,
    token_addr: address,
    new_owner: address
)
```

```move
// transfer fa from user to user.
public fun transfer_fa<FA: key>(
    signer_ref: &signer,
    recipient: address,
    fa: Object<FA>,
    amount: u64
)
```

```move
public fun burn_token<Type: key>(owner: &signer, token: Object<Type>)
```

```move
public fun freeze_transfer<T: key>(creator: &signer, token: Object<T>)
```

```move
public fun unfreeze_transfer<T: key>(creator: &signer, token: Object<T>)
```

```move
public fun set_description<T: key>(creator: &signer, token: Object<T>, description: String)
```

```move
public fun set_name<T: key>(creator: &signer, token: Object<T>, name: String)
```

```move
public fun set_trait_uri(owner: &signer, trait_obj: Object<Trait>, uri: String)
```

```move
// set token properties
public fun add_property<T: key>(
    owner: &signer,
    token: Object<T>,
    key: String,
    type: String,
    value: vector<u8>
)
```

```move
public fun add_typed_property<T: key, V: drop>(
    owner: &signer,
    token: Object<T>,
    key: String,
    value: V,
)
```

```move
public fun remove_property<T: key>(
    owner: &signer,
    token: Object<T>,
    key: String,
)
```

```move
// update token properties
public fun update_property<T: key>(
    owner: &signer,
    token: Object<T>,
    key: String,
    value: vector<u8>,
)
```

```move
public fun get_index<T: key>(token_obj: Object<T>): u64
```

```move
public fun are_properties_mutable<T: key>(token: Object<T>): bool
```

```move
public fun is_burnable<T: key>(token: Object<T>): bool 
```

```move
public fun is_mutable_description<T: key>(token: Object<T>): bool
```

```move
public fun is_mutable_name<T: key>(token: Object<T>): bool
```

```move
public fun is_mutable_uri<T: key>(token: Object<T>): bool
```

```move
public fun get_token_signer<T: key>(token: Object<T>): signer
```

#### DA APIs

#### Trait APIs

```move
// Compose a digital asset to a trait
public fun equip_digital_asset_to_trait(
    signer_ref: &signer,
    trait_object: Object<Trait>,
    da_object: Object<DA>,
    new_uri: String
)
```

```move
// Decompose a digital asset from a trait
public fun unequip_digital_asset_from_trait(
    signer_ref: &signer,
    trait_object: Object<Trait>,
    da_object: Object<DA>,
    new_uri: String
)
```

#### Composable APIs

```move
// Compose trait to a composable token
public fun equip_trait(
    signer_ref: &signer,
    composable_object: Object<Composable>,
    trait_object: Object<Trait>,
    new_uri: String
)
```

```move
// Decompose a digital asset from a composable
public fun unequip_digital_asset_from_composable(
    signer_ref: &signer,
    composable_object: Object<Composable>,
    da_object: Object<DA>,
    new_uri: String
)
```

```move
// Decompose a trait from a composable token. Tests panic.
public fun unequip_trait(
    signer_ref: &signer,
    composable_object: Object<Composable>,
    trait_object: Object<Trait>,
    new_uri: String
)
```

```move
public fun get_traits_from_composable(composable_object: Object<Composable>): vector<Object<Trait>> 
```

## Reference Implementation

* live branch: `devnet`
* sdk: needs to be updated based on the latest version of the module

## Risks and Drawbacks

* Things can go wrong if updating the uri is done wrongly, then it could result in a scam. but i think we can mitigate this by enforcing that the uri is generated on chain.

* The proposed standard will be added on top of existing standards and without making any changes to them. This means that the proposed standard will not break any existing functionality.

## Future Potential

Enhancing digital asset standards with composability can revolutionize industries like gaming, ticketing, and real estate.
Composable digital assets allow for unique character creation in gaming, streamlined ticketing processes, and fractional ownership in real estate. This potentially offers creators innovative solutions across sectors.

## Suggested implementation timeline

* An exploratory version has lived within **`devnet`** branch in `TowneSpace-contract/examples` since January of 2024.

supposing the AIP passes the gatekeeper’s design review.

...

* On devnet: by February 2024
* On testnet: by March 2024
* On mainnet: by April 2024
