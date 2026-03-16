---
aip: 78
title: Aptos Token Objects Framework Update
author: johnchanguk
discussions-to (*optional):
Status: Accepted
last-call-end-date (*optional): <mm/dd/yyyy the last date to leave feedbacks and reviews>
type: Framework
created: 03/23/2024
updated (*optional): <mm/dd/yyyy>
---

# AIP-78 - Aptos Token Objects Framework Update

## Summary

This AIP aims to extend the `collection`, `token` and `property_map` modules from the `aptos-token-objects` framework. Reasons for this are to introduce extensibility and customization to collection and token objects.

## Motivation

Currently there is no way of changing the name or max supply of a collection, nor create a token with the token and custom seed provided. Reasons for wanting this is for example:

1. Some users may not want to have on chain data publicly visible, such as the collection name during collection creation. Being able to set this at a later date allows users to confidently deploy collections without leaking any sensitive information.
2. Users may want to adjust the max supply for a collection. This can occur if there needs to be adjustments in total supply, or simply rectifying mistakes.
3. The current APIs only allow creating one token at a deterministic address with a single name. This AIP provides for a the address to be derived from a user provided seed allowing for multiple tokens at deterministic addresses with the same name.
    1. Solidity provide this mechanism with contract deployment, via both **[CREATE](https://docs.openzeppelin.com/cli/2.8/deploying-with-create2#create)** and [**CREATE2**](https://docs.openzeppelin.com/cli/2.8/deploying-with-create2) opcodes. This enables users to send funds to an address before the smart contract has been deployed to the address.

Furthermore, there is no option to add property maps to an object after the creation of a token object. Currently the only option is to initialize property maps during creation of an object via `ConstructorRef`. Users may wish to allow adding properties on chain at a later stage.

## Specifications

### **Collection module**

1. Add a new method into `collection.move` which changes the name of the collection specified. This will take in `&MutatorRef` just like all mutator functions in the collection module.

```rust
public fun set_name(mutator_ref: &MutatorRef, name: String) acquires Collection {
    assert!(string::length(&name) <= MAX_COLLECTION_NAME_LENGTH, error::out_of_range(ECOLLECTION_NAME_TOO_LONG));
    let collection = borrow_mut(mutator_ref);
    collection.name = name;
    event::emit(
        Mutation { mutated_field_name: string::utf8(b"name") },
    );
}
```

2. Add a new method into `collection.move` which changes the max supply for a collection. This will take in `&MutatorRef` just like all mutator functions in the collection module. This asserts that the new `max_supply` is **greater than the current supply.**

```rust
public fun set_max_supply(mutator_ref: &MutatorRef, max_supply: u64) acquires ConcurrentSupply, FixedSupply {
    let collection = object::address_to_object<Collection>(mutator_ref.self);
    let collection_address = object::object_address(&collection);

    if (exists<ConcurrentSupply>(collection_address)) {
        let supply = borrow_global_mut<ConcurrentSupply>(collection_address);
        let current_supply = aggregator_v2::read(&supply.current_supply);
        assert!(
            max_supply > current_supply,
            error::out_of_range(EINVALID_MAX_SUPPLY),
        );
        supply.current_supply = aggregator_v2::create_aggregator(max_supply);
        aggregator_v2::add(&mut supply.current_supply, current_supply);
    } else if (exists<FixedSupply>(collection_address)) {
        let supply = borrow_global_mut<FixedSupply>(collection_address);
        assert!(
            max_supply > supply.current_supply,
            error::out_of_range(EINVALID_MAX_SUPPLY),
        );
        supply.max_supply = max_supply;
    } else {
        abort error::invalid_argument(ENO_MAX_SUPPLY_IN_COLLECTION)
    };

    event::emit(SetMaxSupply { collection, max_supply });
}
```

### **Token module**

Currently, all token creation functions take in the `collection_name`, which if changed can lead to issues as the collection address
will be calculated incorrectly. To circumvent this, four new functions to create token with `Object<Collection>` will be added. Instead of specifying the `collection_name`, the collection object will be passed in.

1. Add a new method into `collection.move` which creates a token with a unique address with the `Object<Collection>` passed in instead of the `collection_name`.

```rust
public fun create_token(
     creator: &signer,
     collection: Object<Collection>,
     description: String,
     name: String,
     royalty: Option<Royalty>,
     uri: String,
 ): ConstructorRef {
     create(creator, collection::name(collection), description, name, royalty, uri)
 }
```

2. Add a new method into `collection.move` which creates a numbered token with a unique address with the `Object<Collection>` passed in instead of the `collection_name`.

```rust
public fun create_numbered_token_object(
   creator: &signer,
   collection: Object<Collection>,
   description: String,
   name_with_index_prefix: String,
   name_with_index_suffix: String,
   royalty: Option<Royalty>,
   uri: String,
): ConstructorRef {
   create_numbered_token(creator, collection::name(collection), description, name_with_index_prefix, name_with_index_suffix, royalty, uri)
}
```

3. Add a new method into `collection.move` which creates a named token object with a predictable address with the `Object<Collection>` passed in instead of the `collection_name`.

```rust
public fun create_named_token_object(
   creator: &signer,
   collection: Object<Collection>,
   description: String,
   name: String,
   royalty: Option<Royalty>,
   uri: String,
): ConstructorRef {
   create_named_token(creator, collection::name(collection), description, name, royalty, uri)
}
```

4. Add a new method into the `token.move` module which allows creating a token with a predictable address.
    - This takes in the `collection`, `name` and `seed.` The token seed is generated from concatenating the `name` and `seed` and the object address is generated with the collection creator address and token seed.
    - The token address can be derived by passing in the creator of the colletion, as well as name and seed. `token_address_from_seed` returns the token address.

```rust
/// Creates a new token object from a token name and seed.
/// Returns the ConstructorRef for additional specialization.
public fun create_named_token_from_seed(
    creator: &signer,
    collection: Object<Collection>,
    description: String,
    name: String,
    seed: String,
    royalty: Option<Royalty>,
    uri: String,
): ConstructorRef {
    let creator_address = signer::address_of(creator);
    let seed = create_token_seed(&name, &seed);

    let constructor_ref = object::create_named_object(creator, seed);
    create_common(&constructor_ref, creator_address, collection::name(collection), description, name, option::none(), royalty, uri);
    constructor_ref
}

#[view]
public fun token_address_from_seed<T: key>(collection: Object<T>, name: String, seed: String): address {
   let creator = collection::creator(collection);
   let seed = create_token_name_with_seed(&collection::name(collection), &name, &seed);
   object::create_object_address(&creator, seed)
}

public fun create_token_name_with_seed(collection: &String, name: &String, seed: &String): vector<u8> {
   assert!(string::length(name) <= MAX_TOKEN_NAME_LENGTH, error::out_of_range(ETOKEN_NAME_TOO_LONG));
   assert!(string::length(seed) <= MAX_TOKEN_SEED_LENGTH, error::out_of_range(ESEED_TOO_LONG));
   let seeds = *string::bytes(collection);
   vector::append(&mut seeds, b"::");
   vector::append(&mut seeds, *string::bytes(name));
   vector::append(&mut seeds, *string::bytes(seed));
   seeds
}
```

### **Property map module**

Add a new method into the `property_map.move` module which allows extending an object with a `PropertyMap`. This will take in `&ExtendRef` which is needed to generate the `signer` for the object.

```rust
public fun extend(ref: &ExtendRef, container: PropertyMap) {
    let signer = object::generate_signer_for_extending(ref);
    move_to(&signer, container);
}
```

## Reference Implementation
1. [Main implementation](https://github.com/aptos-labs/aptos-core/pull/12737/files)
2. [Update event](https://github.com/aptos-labs/aptos-core/pull/12807/files)

## Risks and Drawbacks

**Collection module**

If the collection name is used as an identifier in existing contracts or off-chain systems, changing the name could break integrations or tracking systems that depend on that name. Changing collection names could make it more difficult to maintain a reliable audit trail. Historical records might refer to the old name, causing confusion or errors in data retrieval.

Also changing the max supply could impact services which rely on this information to be static.

**Mitigations**

Currently, the token address is calculated the same way, but the `token.move` allows changing the name of a token. Therefore we would address consumers to get the collection address the same way the token address is retrieved.

- We will notify services that rely on collection addresses being calculated via collection name, as they will be affected. The collection address will need to be stored for reference, and will need to propagate this directly to consumers. (Indexing, marketplaces etc).
- We will emit a mutation event that we will signal to services that the `name` field of a collection is changed. From this, the collection address must be updated to not be calculated by the collection name.

Changing max supply for a collection will only be possible if the `MutatorRef` is passed in. The `SetMaxSupply` event will be emitted when this the max supply of a collection changes. This is a way to notify downstream on when this occurs.

**Token module**

While predictable addresses can be an advantage for certain use cases, they might also make it easier for malicious actors to interfere with the creation process or engage in front-running.

To generate predictable addresses, there must be a guarantee that there are no same addresses created. If this occurs, then the token cannot be created as the object already exists in global storage.

**Property map module**

Adding in property maps to token objects post creation means that the token can be mutated after. If the token was designed to be immutable from the start, then the `ExtendRef` should be discarded as this would prevent modifications to the current token object.

## Timelines

Target is for mainnet release v1.11.

## Future Potentials

We will plans to extend these modules which introduces flexibility to current development and where we see fit. As the ecosystem matures, we may see additional requirements which benefit the ecosystem.
