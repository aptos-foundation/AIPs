---
aip: 10
title: Move Objects
author: davidiw, wrwg
discussions-to: https://github.com/aptos-foundation/AIPs/issues/27
Status: Draft
last-call-end-date:
type: Standard (Framework)
created: 2023/01/05
updated: 2023/01/23
requires: [AIP-9](Resource Groups)
---

# AIP-10 - Move Objects
## Summary

This AIP proposes *Move objects* for global access to heterogeneous set of resources stored at a single address on-chain. Objects offer a rich capability model that allows for fine-grained resource control and ownership management. By leveraging the aspects of the account model, objects can directly emit events that can lead to richer understanding of on-chain actions.


## Motivation

The object model allows Move on Aptos to represent a complex type as a set of resources stored within a single address. In an object model, an NFT or token can place common token data within a `Token` resource, object data within an `Object` resource, and then specialize into additional resources as necessary, for example, a `Player` object could define a player within a game. The `Object` itself stores both the `address` of the current owner and the appropriate data for creating event streams.

The object model improves type safety and data access through the use of a capability framework implemented by different accessors or references that define and distribute out various capabilities that allow for rich operations. These include:

- `CreatorRef` that allows the creation of all other capabilities, allows adding resources to the object, and can only be accessed at the time the object is created.
- `ObjectId` points to an object. This is useful for storing references to a resource for reverse lookup and other operations.
- `DeleteRef` allows the holder to delete the object from storage.
- `ExtendRef` allows the holder to gain access to the signer to add new resources.
- `TransferRef` allows for the holder to transfer new resources to the object after creation.

A `DeleteRef` stored within a module could allow the creator or owner to burn a token, if present. Whereas a `TransferRef` can be used either within a module to define logic that would determine when an object can be transferred and by whom or it can be given away and treated as a cornerstone as a capability to transfer the object.

Furthermore, the object enables composability of objects, allowing objects to own other objects. Each object stores their owner's identity in their state. The owner can track their objects by storing an `ObjectId`. Thus allowing seamless bi-directional navigation within the object model.

## Rationale

The existing Aptos data model emphasizes the use of the `store` ability within Move. Store allows for a struct to exist within any struct that is stored in global storage, as marked by the `key` ability. As a result, data can live anywhere within any struct and at any address. While this provides great flexibility it has many limitations:

- Data cannot be guaranteed to be accessible, for example, it can be placed within a user-defined resource that may violate some goals for that data, e.g., a creator attempting to burn an NFT put into a user-defined store. This can be confusing to both the users and creators of this data.
- Data of differing types can be stored to a single data structure (e.g., map, vector) via `any`, but for complex data types `any` incurs additional costs within Move as each access requires deserialization. It also can lead to confusion if API developers expect that a specific any field changes the type it represents.
- While resource accounts allow for greater autonomy of data, it does so inefficiently for objects and does not take advantage of resource groups.
- Data cannot be recursively composable, Move currently has a restriction on recursive data structures. Furthermore, experience suggests that true recursive data structures can lead to security vulnerabilities.
- Existing data cannot be easily referenced from entry functions, for example, supporting string validation requires many lines of code. Each key within a table can be very unique and specializing to support within entry functions becomes complex.
- Events cannot be emitted from data but from an account that may not be associated with the data.
- Transferring logic is limited to the APIs provided in the respective modules and generally requires loading resources on both the sender and receiver adding unnecessary cost overheads.

### Alternatives

Along the path several alternatives were considered:

* Using an `OwnerRef` instead of ownership defined within an object. `OwnerRef` provides a natural approach to "nested" objects. However, `OwnerRef` requires additional storage, would still require accessing the object in order to provide for gated storage, and becomes a weak reference in the case of deletable objects.
* Having an explicit object store. Other implementations of Move implement dynamic fields, bags, and other mechanisms to track ownership. This require additional storage, limits deletabiity, and is not iterable. While there may be some applications for this, the goal of Move objects is to enable the developer to dictate their preferred path, while being unopinionated as possible.
* Allowing objects to have store. Having store on an object directly goes against the principles of an object, which is that is always globally accessible.
* More expansive reference or capability set. There's a lot of opportunity to invest in richer means to access and manage objects. Rather than dictate a set of best practices at this point, the goal is to defer that until objects have sufficient bake time in the community. Ultimately the core of objects that is defined herein should be sufficient to support any direction for higher level functionality that ideally generalizes across all applicatoins.
* Add support for revocation of existing ref or capabilities. Each ref that has store ability can be placed into any module with the intent of allowing the creator to dictate how the object may evolve over time. Because of this, there exists no generalizable means to actually revoke a specific capability. Capabilities can be given to an account or a to a module and stored anywhere. The intent is to keep them limber so as to not impact storage or add additional friction around their use. With caution of course, as naive use of capabilities can result in undesirable behavior.

## Specification

### Overview

Objects are built with the following considerations:

- Simplified storage interface for heterogeneous types.
- Enable a rich and dynamic data model while limited impact on storage, i.e., storage should not take up more than effectively a single resource (storage slot): see Resource Groups AIP.
- Data is immobile but ownership is still flexible.
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

An object is stored in the `ObjectGroup` resource group. This allows additional resources within the object to be co-located for data locality and data cost savings. Note, all resources within an object need not be co-located within the `ObjectGroup`. This is left to the developer of an object ot define their data layout.

```move
#[resource_group(scope = global)]
struct ObjectGroup { }
```

The core `Object` is represented by the following move struct:

```move
#[resource_group_member(group = aptos_framework::object::ObjectGroup)]
struct Object has key {
    /// Used by guid to guarantee globally unique objects and create event streams
    guid_creation_num: u64,
    /// The address (object or account) that owns this object
    owner: address,
    /// Object transferring is a common operation, this allows for disabling and enabling
    /// transfers. Bypassing the use of a the TransferRef.
    allow_ungated_transfer: bool,
    /// Emitted events upon transferring of ownership.
    transfer_events: event::EventHandle<TransferEvent>,
}
```

### Object Id

Each object is stored in its own address or *object id*. Object ids can be generated from a user provided input or from the current account's globally unique ID generator (`guid.move`). Furthermore, object id generation leverages a domain separator that is different from existing account address generation: `sha3_256(address_of(creator) | seed | 0xFE)`, where `0xFE` is uniquely reserved for objects.

- GUIDs
  - `seed` is the current guid produced by `guid.move`: `bcs::to_bytes(account address | u64)`.
  - Can be deleted, since the object cannot be recreated.
- User-specified
  - `seed` is defined by the user, such as a string.
  - Cannot be deleted, since the object could be recreated, minimally, such a conflict could impact proper event number sequencing.

### Capabilities

- `ObjectId`
    - A pointer to an object, a type-safe wrapper around address
    - Abilities: `copy, drop, store`
    - Data layout `{ inner: address }`
- `CreatorRef`
    - Provided to the object creator at creation time
    - Can create any other ref type
    - Abilities: `drop`
    - Data layout `{ self: ObjectId, can_delete: bool }`
- `DeleteRef`
    - Can be used to remove an object from the `ObjectGroup`
    - There can be many for a single object
    - Cannot be created if the object id was generated from user input
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
- `LinearTransferRef`
    - Used to actually perform the transfer
    - Enforces an entity can only transfer once, assuming that they do not have direct access to `TransferRef`
    - Abilities: `drop`
    - Data layout `{ self: ObjectId, owner: address }`

### API

```move
public fun id_to_object_id(id: ID): ObjectId;
public fun address_to_object_id(object_id: address): ObjectId;

public fun create_object(creator: &signer, guid: GUID): CreatorRef;
public fun generate_deleter(creator: &CreatorRef): DeleteRef;
public fun generate_extender(creator: &CreatorRef): ExtendRef;
public fun generate_transfer(ceator: &CreatorRef): TransferRef;

/// Disable direct transfer, transfers can only be triggered via a TransferRef
public fun disable_ungated_transfer(ref: &TransferRef);
/// Enable direct transfer
public fun enable_ungated_transfer(ref: &TransferRef);
/// Generates a one-time use transfer ref
public fun generate_linear_transfer(ref: &TransferRef): LinearTransferRef;
/// Direct transfer between two entities, only allowed if ungated transfer is enabled
public entry fun transfer(owner: &signer, object_id: address, to: address);
/// Transfer using a validated transfer ref, ignores the ungated transfer flag
public fun transfer_with_ref(ref: LinearTransferRef, object_id: ObjectId, to: address);

public fun generate_signer(creator: &CreatorRef): &signer;
public fun generate_signer_for_extending(extender: &ExtendRef): &signer;
public fun delete(delete_ref: DeleteRef);

struct TransferEvent has drop, store {
    object_id: address,
    from: address,
    to: address,
}
```

## Reference Implementation

First commit in https://github.com/aptos-labs/aptos-core/pull/5976

## Risks and Drawbacks

Open areas for discussion include:

- Should addition and deletion of resources count the number of resources within an object to ensure that deletion is complete?
- Should we mark user input-based object's as deleted rather than not supporting it at all?

## Future Potential

- Allow for entry functions to dictate (expected) capabilities associated with objects, either via attributes or by allowing for certain `Ref` types to be passed in.
- Allow users to dictate which resources can be transferred to them. This can be done by either 1) supporting a user object store that represents objects that the user has accepted or 2) having a flag in the account structure that indicates whether or not the user is willing to accept objects.

## Suggested implementation timeline

- A trivial implementation is complete and ready for review.
- Assuming generally positive feedback, this could progress to the February Testnet cut.
- If that goes well, it could be on Mainnet by March.
