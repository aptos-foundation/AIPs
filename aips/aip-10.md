---
aip: 10
title: Move Objects
author: davidiw, wrwg
discussions-to: https://github.com/aptos-foundation/AIPs/issues/27
Status: Accepted
last-call-end-date:
type: Standard (Framework)
created: 2023/01/05
updated: 2023/01/23
requires: "AIP-9: Resource Groups"
---

# AIP-10 - Move Objects

## Summary

This AIP proposes *Move objects* for global access to heterogeneous set of resources stored at a single address on-chain. Objects offer a rich capability model that allows for fine-grained resource control and ownership management. By leveraging the aspects of the account model, objects can directly emit events that can lead to richer understanding of on-chain actions.

## Motivation

The object model allows Move to represent a complex type as a set of resources stored within a single address. In an object model, an NFT or token can place common token data within a `Token` resource, object data within an `ObjectCore` resource, and then specialize into additional resources as necessary, for example, a `Player` object could define a player within a game. The `ObjectCore` itself stores both the `address` of the current owner and the appropriate data for creating event streams.

The object model improves type-safety and data access through the use of a capability framework implemented by different accessors or references that define and distribute out various capabilities that allow for rich operations. These include:

- `ConstructorRef` that allows the creation of all other capabilities, allows adding resources to the object, and can only be accessed at the time the object is created.
- `Object<T>` points to an object that contains `T` resource. This is useful for storing references to a resource for reverse lookup.
- `DeleteRef` allows the holder to delete the object from storage.
- `ExtendRef` allows the holder to gain access to the signer to add new resources.
- `TransferRef` allows for the holder to transfer new resources to the object after creation.

A `DeleteRef` stored within a module could allow the creator or owner to burn a token, if present. Whereas a `TransferRef` can be used either within a module to define logic that would determine when an object can be transferred and by whom or it can be given away and treated as a cornerstone as a capability to transfer the object.

Furthermore, the object enables composability of objects, allowing objects to own other objects. Each object stores their owner's identity in their state. The owner can track their owned-objects by creating and storing an `Object<T>` within its own storage. Thus allowing seamless bi-directional navigation within the object model.

## Rationale

The existing Aptos data model emphasizes the use of the `store` ability within Move. Store allows for a struct to exist within any struct that is stored in global storage, as marked by the `key` ability. As a result, data can live anywhere within any struct and at any address. While this provides great flexibility it has many limitations:

- Data is not be guaranteed to be accessible, for example, it can be placed within a user-defined resource that may violate expectations for that data, e.g., a creator attempting to burn an NFT put into a user-defined store. This can be confusing to both the users and creators of this data.
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

- Simplified storage interface that supports a heterogeneous collection of resources to be stored together. This enables data types to share a common core data layer (e.g., tokens), while having richer extensions (e.g., concert ticket, sword).
- Globally accessible data and ownership model that enables creators and developers to dictate the application and lifetime of data.
- Extensible programming model that supports individualization of user applications that leverage the core framework including tokens.
- Support emitting events directly, thus improving discoverability of events associated with objects.
- Considerate of the underlying system by leveraging resource groups for gas efficiency, avoiding costly deserialization and serialization costs, and supporting deletability.

### Object Lifecycle

- An entity calls create on a top-level object type.
- The top-level object type calls create on its direct ancestor.
- This is repeated until the top-most ancestor is the `Object` struct, which defines the `create_object` function.
- The `create_object` generates a new address, stores an `Object` struct at that address within the `ObjectGroup` resource group, and returns back a `ConstructorRef`.
- The create functions called earlier can use the `ConstructorRef` to obtain a signer, store an appropriate struct within the `ObjectGroup` resource, make any additional modifications, and return the `ConstructorRef` back up the stack.
- In the object creation stack, any of the modules can define properties such as ownership, deletion, transferability, and mutability.

### The Core Object

An object is stored in the `ObjectGroup` resource group. This allows additional resources within the object to be co-located for data locality and data cost savings. Note, all resources within an object need not be co-located within the `ObjectGroup`. This is left to the developer of an object ot define their data layout.

```move
#[resource_group(scope = global)]
struct ObjectGroup { }
```

The core `ObjectCore` is represented by the following move struct:

```move
#[resource_group_member(group = aptos_framework::object::ObjectGroup)]
struct ObjectCore has key {
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

### Object

Each object is stored in its own address represented by `Object<T>`. The underlying address can be generated from a user provided input or from the current account's globally unique ID generator (`guid.move`). Furthermore, address generation leverages a domain separator that is different from existing account address generation: `sha3_256(address_of(creator) | seed | DOMAIN_SEPaRATOR)`.

- GUIDs
  - `seed` is the current guid produced by `guid.move`: `bcs::to_bytes(account address | u64)`.
  - Can be deleted, since the object cannot be recreated.
  - The `DOMAIN_SEPaRATOR` is 0xFD.
- User-specified
  - `seed` is defined by the user, such as a string.
  - Cannot be deleted, since the object could be recreated, minimally, such a conflict could impact proper event number sequencing.
  - The `DOMAIN_SEPaRATOR` is 0xFE.

### Capabilities

- `Object<T>`
    - A pointer to an object, a wrapper around address
    - Abilities: `copy, drop, store`
    - Data layout `{ inner: address }`
- `ConstructorRef`
    - Provided to the object creator at creation time
    - Can create any other ref type
    - Abilities: `drop`
    - Data layout `{ self: ObjectId, can_delete: bool }`
- `DeleteRef`
    - Used to remove an object from the `ObjectGroup`
    - There can be many for a single object
    - Cannot be created if the object address was generated from user input
    - Abilities: `drop`, `store`
    - Data layout: `{ self: ObjectId }`
- `ExtendRef`
    - Used to create events or move additional resources into object storage.
    - Abilities: `drop, store`
    - Data layout `{ self: ObjectId }`
- `TransferRef`
    - Used to create LinearTransferRef, hence ownership transfer.
    - Abilities: `drop, store`
    - Data layout `{ self: ObjectId }`
- `LinearTransferRef`
    - Used to perform transfers.
    - Enforces an entity can only transfer once, assuming that they do not have direct access to `TransferRef`
    - Abilities: `drop`
    - Data layout `{ self: ObjectId, owner: address }`

### API Functions

Functions for `address` conversions to and from `ObjectId`:
```move
/// Produces an Object from the given address. This verifies that T exists.
public fun address_to_object<T: key>(object: address): Object<T>;

/// Returns the address of within an ObjectId.
public fun object_address<T>(object: &Object<T>): address;

/// Derives an object address from source material: sha3_256([creator address | seed | 0xFE]).
/// The Object needs to be distinct from create_resource_address
public fun create_object_address(source: &address, seed: vector<u8>): ObjectId;
```

Functions for creating objects:
```move
/// Create a new named object and return the ConstructorRef. Named objects can be queried globally
/// by knowing the user generated seed used to create them. Named objects cannot be deleted.
public fun create_named_object(creator: &signer, seed: vector<u8>): ConstructorRef;

/// Create a new object from a GUID generated by an account.
public fun create_object_from_account(creator: &signer): ConstructorRef;

/// Create a new object from a GUID generated by an object.
public fun create_object_from_object(creator: &signer): ConstructorRef;

/// Generates the DeleteRef, which can be used to remove Object from global storage.
public fun generate_delete_ref(ref: &ConstructorRef): DeleteRef;

/// Generates the ExtendRef, which can be used to add new events and resources to the object.
public fun generate_extend_ref(ref: &ConstructorRef): ExtendRef;

/// Generates the TransferRef, which can be used to manage object transfers.
public fun generate_transfer_ref(ref: &ConstructorRef): TransferRef;

/// Create a signer for the ConstructorRef
public fun generate_signer(ref: &ConstructorRef): signer;

/// Returns the address of within a ConstructorRef
public fun object_from_constructor_ref<T: key>(ref: &ConstructorRef): Object<T>;
```

Functions for adding new events and resources to the object:
```move
/// Create a guid for the object, typically used for events
public fun create_guid(object: &signer): guid::GUID;

/// Generate a new event handle.
public fun new_event_handle<T: drop + store>(object: &signer): event::EventHandle<T>;
```

Functions for deleting objects:
```move
/// Returns the address of within a DeleteRef.
public fun object_from_delete<T: key>(ref: &DeleteRef): Object<T>;

/// Removes from the specified Object from global storage.
public fun delete(ref: DeleteRef);
```

Functions for extending the object:
```move
/// Create a signer for the ExtendRef
public fun generate_signer_for_extending(ref: &ExtendRef): signer;
```

Functions for transferring the object:
```move
/// Disable direct transfer, transfers can only be triggered via a TransferRef
public fun disable_ungated_transfer(ref: &TransferRef);

/// Enable direct transfer.
public fun enable_ungated_transfer(ref: &TransferRef);

/// Create a LinearTransferRef for a one-time transfer. This requires that the owner at the
/// time of generation is the owner at the time of transferring.
public fun generate_linear_transfer_ref(ref: TransferRef): LinearTransferRef;

/// Transfer to the destination address using a LinearTransferRef.
public fun transfer_with_ref(ref: LinearTransferRef, to: address);

/// Entry function that can be used to transfer, if allow_ungated_transfer is set true.
public entry fun transfer_call(owner: &signer, object: address, to: address);

/// Transfers the given object if allow_ungated_transfer is set true. Note, that this allows
/// the owner of a nested object to transfer that object, so long as allow_ungated_transfer is
/// enabled at each stage in the hierarchy.
public fun transfer<T>(owner: &signer, object: Object<T>, to: address);

/// Transfer the given object to another object. See `transfer` for more information.
public fun transfer_to_object<O, T>(owner: &signer, object<O>: Object, to: Object<T>);
```

Functions for validating ownership
```move
/// Return the current owner.
public fun owner<T: key>(object: Object<T>): address;

/// Return true if the provided address is the current owner.
public fun is_owner<T: key>(object: Object<T>, owner: address): bool;
```

### API Events

```move
/// Emitted whenever the objects owner field is changed.
struct TransferEvent has drop, store {
    object: address,
    from: address,
    to: address,
}
```

## Reference Implementation

First commit in https://github.com/aptos-labs/aptos-core/pull/5976

## Risks and Drawbacks

Open areas for discussion include:

- Should addition and deletion of resources count the number of resources within an object to ensure that deletion is complete?
- Should we mark user input-based object's as deleted rather than not supporting it at all? That way DeleteRef is still useful at higher layers.
- Should the object track which refs have been generated and should they be hot potatoes? Alternatively, should events be emitted?
- Should an `Object<T>` pointing to an object prevent it from being deleted?

The current base object can be extended to support all these use cases. The decision is to err on the side of less restrictive, so that decisions can be enacted afterward as the object standard evolves.

## Future Potential

- Allow for entry functions to dictate (expected) capabilities associated with objects, either via attributes or by allowing for certain `Ref` types to be passed in.
- Allow users to dictate which resources can be transferred to them. This can be done by either 1) supporting a user object store that represents objects that the user has accepted or 2) having a flag in the account structure that indicates whether or not the user is willing to accept objects.
- `Alias<T>`
    - Assume module `hero` defines multiple versions of a struct (`HeroV1`, `HeroV2`, ...)
    - The application only cares about referencing the concept of `Hero` in module `hero` not the specific version.
    - The API can never reveal the versioned `Hero` due to borrow global semantics, the module itself can expect `Object<Hero>` and dispatch to the relevant version of `Hero`.
- Disabling transfer events
    - Objects may at some point be used to create rich data structures and the cost of events might be non-negligible.
    - It remains to be seen after gas optimizations how much this actually incurs relative to the execution costs.
- Unique resource-named container objects
    - Object containers for fungible assets result in multiple copies that cannot be found without an explicit reference provided as an input to a transaction.
    - Let's provide a new object address scheme: `account_address | type_info<T>() | 0xFC`
    - Objects at these addresses are created via `create_typed_object<T>(account: &signer, &_proof: T)`, that ensures that these objects actually will contain T, a store for fungible assets.
    - Now, any other object can read this on-chain without any input from the transaction, e.g., `balance<0x1::aptos_coin::AptosCoin>(addr)` would read from the `0x1::coin::CoinStore` object stored at `addr | 0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin> | 0xFC`.
    - Address computatoin may be non-negligible, so it will be beneficial to support an explicitly addressed API as well.

## Suggested implementation timeline

- A trivial implementation is complete and ready for review.
- Assuming generally positive feedback, this could progress to the February Testnet cut.
- If that goes well, it could be on Mainnet by March.
