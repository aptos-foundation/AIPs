---
aip: 11
title: Move Objects
author: davidiw, wrwg
discussions-to: https://github.com/aptos-foundation/AIPs/issues/27
Status: Draft
last-call-end-date:
type: Standard (Framework)
created: 2023/01/05
updated: N/A
requires: AIP_number_of(Resource Groups)
---

# AIP-11 - Move Objects

## Summary

This AIP proposes Move objects for global access to heterogeneous set of resources stored at a single address on-chain. By leveraging the aspects of the account model, objects can directly emit events that can lead to richer understanding of on-chain actions. Finally, objects offer a rich capability model that allows for fine-grained resource control and ownership objects in a single store.

## Motivation

The object model allows Move on Aptos to represent a complex type as a set of resources stored within a single address. In an object model, an NFT or token can place common token data within a `Token` resource, object data within an `Object` resource, and then specialize into additional resources as necessary, for example, a `Player` object could define a player within a game. The `Object` itself stores both the `address` of the current owner, the appropriate data for creating event streams, and a value to denote if the object has been deleted.

The object model improves type safety and data access through the use of a capability framework implemented by different accessors or references that define and distribute out various capabilities that allow for rich operations. These include:

- `CreatorRef` that allows the creation of all other capabilities, allows adding resources to the object, and can only be accessed at the time the object is created.
- `ObjectId` points to an object. This is useful for storing references to a resource for reverse lookup and other operations.
- `DeleteRef` allows the holder to delete the object from storage.
- `TransferRef` allows for the holder to transfer new resources to the object after creation.

A `DeleteRef` stored within a module could allow the creator or owner to burn a token, if present.
An object can own other objects thus allowing composability. A `ObjectId` allows for reverse lookups of owned to owner, thus allowing seamless navigation of the object model.

## Rationale

The existing Aptos data model emphasizes the use of the `store` ability within Move. As a result, data can live anywhere, e.g., anyone can publish a module that can contain this data. While this provides great flexibility it has many limitations:

- Data cannot be guaranteed to be accessible, someone could store the data in an unaddressable location that might violate some of the goals for that data, e.g., the creators ability to burn an NFT. This can be confusing to both the users and creators of this data.
- Heterogeneous data cannot be stored together. In order to ensure that tokens can co-exist, the data type has been frozen, the only expressability comes via the `property_map`.
- Data of differing types can be stored to a single data structure via `any`, but for complex data types `any` incurs additional costs within Move as each access requires deserialization. Use of `any` can also lead to run-time type mismatch as the data within an `any` can be changed throughout its lifetime.
- The existing model limits programmability that provides more autonomy of the underlying data. While this has been somewhat addressed by resource accounts, much of the data associated with a resource account goes unused and can be an inefficient representation. Additionally, resource accounts still provide direct access to the account signer after creation, which can have security implications.
- Data cannot be recursively composable, Move currently has a restriction on recursive data structures. Furthermore, experience suggests that true recursive data structures can lead to security vulnerabilities.
- Existing data cannot be easily referenced from entry functions, for example, supporting string validation requires many lines of code. Each key within a table can be very unique and specializing to support within entry functions becomes complex.
- Events cannot be emitted from data but from an account that may not be associated with the data.
- The existing data model makes it challenging to provide rich accessibility models as behavior must be defined well before applications can be built. This leads to excessively complex security policies and unnecessary data to support flexible configuration.
- The existing Move model has only a single capability — signer, everything else must be defined and codified by the developer of a module.
- Transferring logic is limited to the APIs provided in the respective modules and generally requires loading resources on both the sender and receiver adding unnecessary cost overheads.

## Specification

### Overview

Objects are built with the following considerations:

- Simplified storage interface for heterogeneous types.
- Enable a rich and dynamic data model while limited impact on storage, i.e., storage should not take up more than effectively a single resource (storage slot): see Resource Groups AIP.
- Data is immobile but ownership still remains portable: storing data in resources and ownership within `OwnerRef`.
- Make easily usable from entry functions: each object is stored at an address, which is a supported API type.
- Offer rich set of capabilities: the `Ref` model.
- Support emitting events directly: directly built-in.
- Simplified access to storage avoiding costly deserialization, serialization: resources, once loaded, have limited costs associated with future access.
- Objects are deletable.
- Support assistance modes that allow external entities to manage assets on behalf of owners.

### Object Lifecycle

- An entity calls create on a top-level object type.
- The top-level object type calls create on its direct ancestor.
- This is repeated until the top-most ancestor is the `Object` struct, which defines the `create_object` function.
- The `create_object` generates a new address, stores an `Object` struct at that address within the `ObjectGroup` resource group, and returns back a `CreatorRef`.
- The create functions called earlier can use the `CreatorRef` to obtain a signer, store an appropriate struct within the `ObjectGroup` resource, make any additional modifications, and return the `CreatorRef` back up the stack.
- In the object creation stack, any of the modules can define properties such as ownership, deletion, transferability, and mutability.

### The Core Object

An object is stored in the `ObjectGroup` resource group. The core `Object` contains a single field: `guid_creation_num`, which is used to create distinct event streams.

```move
#[resource_group(scope = global)]
struct ObjectGroup { }

#[resource_group_member(group = aptos_framework::object::ObjectGroup)]
struct Object {
    guid_creation_num: u64,
    owner: address,
    deleted: bool,
}
```

### Object Id

Each object is stored in its own address or object id. To ensure unique Ids, the object ids are generated with a domain separator that is different from existing account address generation: `sha3_256(address_of(creator) | seed | 0xF4)`, where `0xF4` is uniquely reserved for objects.

### Capabilities

- `ObjectId`
    - A pointer to an object, a type-safe wrapper around address
    - Abilities: `copy, drop, store`
    - Data layout `{ inner: address }`
- `CreatorRef`
    - Provided to the object creator at creation time
    - Can create any other ref type
    - Abilities: `drop`
    - Data layout `{ self: ObjectId }`
- `DeleteRef`
    - Can be used to remove an object from the `ObjectGroup`
    - There can be many for a single object
    - They cannot be aggregated
    - Abilities: `drop`, `store`
    - Data layout: `{ self: ObjectId }`
- `ExtendRef`
    - Can be used to move an object into the `ObjectGroup`
    - Abilities: `drop, store`
    - Data layout `{ self: ObjectId }`
- `TransferRef`
    - Can be used transfer ownership of the object from one address to another
    - Abilities: `drop, store`
    - Data layout `{ self: ObjectId }`

### API

```move
public fun create_object(creator: &signer, seed: vector<u8>): CreatorRef;
public fun generate_object_id(object_id: address): OwnerRef;
public fun generate_deleter(creator: &CreatorRef): DeleteRef;
public fun generate_extender(creator: &CreatorRef): ExtendRef;
public fun generate_transfer(ceator: &CreatorRef): TransferRef;

public fun get_signer(creator: &CreatorRef): &signer;
public fun get_signer_for_extending(extender: &ExtendRef): &signer;
public fun delete(delete_ref: DeleteRef);

struct TransferEvent has drop, store {
    object_id: address,
    from: address,
    to: address,
}
```

## Reference Implementation

There is an early reference implementation in the following PR: https://github.com/aptos-labs/aptos-core/pull/5976

## Risks and Drawbacks

Open areas for discussion include:

- Should addition and deletion of resources count the number of resources within an object to ensure that deletion is complete?
- How explicit should this AIP be about any of the abilities? Should there be a BaseObject for trivial usage that dictates an owner-centric set of policies.
- Deletion could be complete, but then we need to ensure two objects can never be stored at the same address. An objected created over another risks corrupting storage due to overlapping event streams.

## Future Potential

- Allow for entry functions to dictate (expected) capabilities associated with objects, either via attributes or by allowing for certain `Ref` types to be passed in.
- Allow users to dictate which resources can be transferred to them.

## Suggested implementation timeline

- A trivial implementation could be on Devnet by middle of January
- Assuming generally positive feedback, this could progress to the February Testnet cut
- If that goes well, it could be on Mainnet by March
