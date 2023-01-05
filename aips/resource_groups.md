---
aip: (this is determined by the AIP Manager)
title: Resource Groups
author: davidiw, wrwg
discussions-to: https://github.com/aptos-foundation/AIPs/issues/26
Status: Draft
last-call-end-date:
type: Standard (Interface, Framework)
created: 2023/1/5
updated: N/A
requires: N/A
---

## Summary

This AIP proposes resource groups to support storing multiple distinct Move resources together into a single storage slot.

Note: The general feedback seen so far implies that the requirements are not well established, so I’m going to revisit the wording in the doc and maybe add more bullet points. It is also imperative to understand what a resource is and the limitations of of resources, perhaps adding a background section that covers these concepts would have improved the readability.

## Motivation

Over the course of development, it often becomes convenient to add new fields to a resource or support an optional, heterogeneous set of resources within an account. However, resources and structs are immutable after being published to the blockchain, hence, the only pathway to add a new field is via a new resource.

Each distinct resource within Aptos requires storage slot. Each storage slot is a unique entry within a Merkle tree or authenticated data structure. Each proof within the authenticated data structure occupies `32 * LogN` bytes, where `N` is the total amount of storage slots. At `N = 1,000,000`, this results in a 640 byte proof.

Adding even a single new resource with only an event handle uses approximately 40 bytes for storing the event handle; however, it requires an additional proof which is typically orders of magnitude larger. Beyond the capacity demands, reads and writes incur additional costs associated with proof verification and generation, respectively.

Resource groups allow for dynamic, co-location of data such that adding a new event can be done even after creation of the resource group and with a fixed storage and execution costs independent of the amount of slots in storage.

## Rationale

A resource group co-locates data into a single storage slot by encoding within the Move source files attributes that specify which resources should be combined into a single storage slot. Resource groups have no semantic effect on Move, only on the organization of storage and its performance.

At the storage layer, the resource groups are stored as a BCS-encoded BTreeMap where the key is a BCS-encoded fully qualified struct name and the value is the BCS-encoded data associated with the resource.

### Alternative 1 — Any within a SimpleMap

One alternative that was considered is storing data in a `SimpleMap` using the `any` module. While this is a model that could be shipped without any change to Aptos-core, it incurs some drawbacks  around developer and application complexity both on and off-chain. There’s no implicit caching, and therefore any read or write would require a deserialization of the object and any write would require a serialization. This means a transaction with 3 writes would result in 3 deserializations and 3 serializations. In order to get around this, the framework would need substantial, non-negligible changes and thus this was quickly abandoned. Finally, due to the lack of a common pattern, indexers and APIs would not be able to easily access this data.

### Alternative 2 — Generics

Another alternative was using templates. The challenge with using templates is that data cannot be partially read without knowing what the template is. For example, consider an object that might be a token. In resource groups, one could easily read the `Object` or the `Token` resource. In templates, one would need to read the `Object<Token>`. This could also be worked around by complex framework changes and risks around partially reading BCS-encoded data, an application, which has yet to be considered. The same issues in Move would impact those using the REST API.

### Generalizations of Issues

There are myriad combinations between the above two approaches. In general, the drawbacks are

- High costs associated with deserialization and serialization for each read and/or write.
- The current limitations around returning a reference to global memory limit utility of generics and add overheads to reads and writes of objects.
- Limited standardization resulting in more complexity for API and Indexer usage.
- A `struct` with `key` ability has better properties than `store`. For example, the latter can lead to data being stored in arbitrary places, complicating global addressing and discoverability, which may be desirable for certain applications.

## Specification

### Within the Framework

A resource group consists of several distinct resources, or a Move `struct` that has the `key` ability.

Each resource group is identified by a common container:

```move
#[resource_group_container(scope = global)]
struct ObjectGroup { }
```

Where the container is a fully qualified struct with no fields and the attribute: `resource_group_container`. The attribute `resource_group_container` has the parameter `scope` that limits the location of other entries within the resource group:

- `module` — only resources defined within the same module may be stored within the same resource group.
- `address` — only resources defined within the same address may be stored within the same resource group.
- `global` — there are no limitations to where the resource is defined, any resource can be stored within the same resource group.

The motivation of using a `struct` is that

1. It allows all resources within the group to have a compile time validation that they are within that group
2. It can build upon the existing storage model that knows how to read and write data stored at  `StructTag`s. Thus it limits the implementation impact to the VM and readers of storage, storage can remain agnostic to this change.
3. Only `struct` and `fun` can have attributes, which in turn let’s us define additional parameters like `scope`.

Each entry in a resource group is identified by the `resource_group` attribute:

```move
#[resource_group(container = aptos_framework::object::ObjectGroup)]
struct Object has key {
    guid_creation_num: u64,
}

#[resource_group(container = aptos_framework::object::ObjectGroup)]
struct Token has key {
    name: String,
}
```

During compilation and publishing, these attributes are checked to ensure that:

1. A `resource_group_container` has no abilities and no fields.
2. The `scope` within the `resource_group_container` can only become more permissive, that is it can either remain at a remain at the same level of accessibility or increase to the next.
3. Each entry within a resource group has a `resource_group` attribute.
4. The `container` parameter is set to a struct that is labeled as a `resource_group_container`.
5. During upgrade, an existing `struct` cannot either enter or leave a `resource_group`.

### Within Storage

From a storage perspective, resource group is stored as a BCS-encoded `BTreeMap<StructTag, BCS encoded MoveValue>`, where a `StructTag` is a known structure in Move of the form: `{ account: Address, module_name: String, struct_name: String }`.  Whereas, a typical resource is stored as a `BCS encoded MoveValue`.

At read time, a resource must be checked to see if that resource is part of a resource group by reading the associated metadata with a resource. If it is, the data is read from the resource group’s `StructTag` instead.

At write time, an element of a resource group must be appropriately updated into a resource group by determining the delta the resource group as a result of the write operation. This results in the handful of possibilities:

- The resource group doesn’t exist in storage, this is a new write op.
- The resource group already exists, then this is a modification, even if the element is new to the resource group or an element is being removed.
- All the elements have been removed, then this is a deletion.

### Within the Gas Schedule and the VM

The implications for the gas schedule are:

- Reading a single resource from a resource group results in a charge for all the data within a resource group.
- Writing a single resource to a resource group results in a charge for all the data within a resource group.

### Within the Interface

To read a resource group from storage:

- Attempt to read the resource from an account directly and find that it does not exist
- Read the `struct` metadata from storage and find that it is within a resource group
- Read the resource group from storage
- Parse and return the resource from the resource group

## Reference Implementation

[https://github.com/aptos-labs/aptos-core/pull/6040](https://github.com/aptos-labs/aptos-core/pull/6040)

## Risks and Drawbacks

- This requires adjustments to the API layer to read resources stored within a resource group.
- Paginated reads of resources on an account would need to be able to handle the discrepancy between distinct resources and those that are directly countable.
- Entities reading change sets would need to be aware of how resources within resource groups are stored.
- Each resource within a resource group adds the cost of a `StructTag` (likely much less than 100 bytes). Accesses to a resource group will incur an extra deserialization for reads and an extra deserialization and serialization for writes. This is cheaper than alternatives and still substantially cheaper than storage costs. Of course, developers are free to explore the delta in their own implementations as resource groups does not eliminate individual resources.

None of these are major roadblocks and will be addressed as part of the implementation of Resource Groups.

## Future Potential

While resources cannot seamlessly adopted into resource groups, it is likely that many of the commonly used resources are migrated into new resources within resource groups to give more flexibility to upgradeability, because a resource group does not lock developers into a fixed resource layout. In fact, this returns Aptos back to supporting a more idiomatic Move, which co-locates resources stored at an address — being freed from perf considerations which hindered developers before.

Another area worth investigating is whether or not a templated struct can be within a resource group depending on what the generic type is. Consider the current Aptos `Account` and the `CoinStore<AptosCoin>`. Storing them separately has negative impact on performance and storage costs.

In the current VM implementation, resources are cached upon read. This can be improved with caching of the entire resource group at read time.

## Suggested implementation timeline

- A trivial implementation could be on Devnet by middle of January
- Assuming generally positive feedback, this could progress to the February Testnet cut
- If that goes well, it could be on Mainnet by March

## References

- [any.move](https://github.com/aptos-labs/aptos-core/blob/main/aptos-move/framework/aptos-stdlib/sources/any.move)
- [simple_map.move](https://github.com/aptos-labs/aptos-core/blob/main/aptos-move/framework/aptos-stdlib/sources/simple_map.move)
- [StructTag](https://github.com/move-language/move/blob/fcb75d8036d81e06bcb6ac102a414590e753579b/language/move-core/types/src/language_storage.rs#L91)
- [Aptos Authenticated Data Structures](https://github.com/aptos-labs/aptos-core/blob/main/documentation/specifications/common/authenticated_data_structures.md)
- [Move Language Book](https://move-language.github.io/move/)
- [Earlier proposal](https://www.notion.so/Storage-and-Language-d3bf1c128c4449388921fe2dde8038b6)
