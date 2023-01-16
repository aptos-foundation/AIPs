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

## Motivation

Over the course of development, it often becomes convenient to add new fields to a resource or support an optional, heterogeneous set of resources. However, resources and structs are immutable after being published to the blockchain, hence, the only pathway to add a new field is via a new resource.

Each distinct resource within Aptos requires a storage slot. Each storage slot is a unique entry within a Merkle tree or authenticated data structure. Each proof within the authenticated data structure occupies `32 * LogN` bytes, where `N` is the total amount of storage slots. At `N = 1,000,000`, this results in a 640 byte proof.

With 1,000,000 storage slots in use, adding even a new resource that contains only an event handle uses approximately 680 bytes, where the event handle requires only 40. The remaining 640 bytes comes from the new authenticated data proofs, which can be orders of magnitude larger than the data being authenticated. Beyond the capacity demands, reads and writes incur additional costs associated with proof verification and generation, respectively.

Resource groups allow for dynamic, co-location of data such that adding a new event can be done even after creation of the resource group and with a fixed storage and execution costs independent of the amount of slots in storage. In turn, this provides a convenient way to evolve data types and co-locate data from different resources.

## Rationale

A resource group co-locates data into a single storage slot by encoding within the Move source files attributes that specify which resources should be combined into a single storage slot. Resource groups have no semantic effect on Move, only on the organization of storage.

At the storage layer, the resource groups are stored as a BCS-encoded BTreeMap where the key is a BCS-encoded fully qualified struct name (`address::module_name::struct_name`, e.g., `0x1::account::Account`) and the value is the BCS-encoded data associated with the resource.

![image](https://user-images.githubusercontent.com/73818/212690642-f8c24ed8-8869-4ce2-9941-4958aae3f8a9.png)

The above diagram illustrates data stored at address `0xcafef00d`. `0x1::account::Account` is a resource stored at address `0xcafef00d`. `0xaa::resource::Group` contains a set of resources or a resource group stored at the same address. The resource group packs multiple resources into the group. Resources within a resource group require nested reading, wherein first the resource group must be read from storge followed by reading the specific resource from the resource group.

### Alternative 1 — Any within a SimpleMap

One alternative that was considered is storing data in a `SimpleMap` using the `any` module. While this is a model that could be shipped without any change to Aptos-core, it incurs some drawbacks around developer and application complexity both on and off-chain. There’s no implicit caching, and therefore any read or write would require a deserialization of the object and any write would require a serialization. This means a transaction with 3 writes would result in 3 deserializations and 3 serializations. In order to get around this, the framework would need substantial, non-negligible changes, though with the emergence of `SmartMap` there may be more viability here. Finally, due to the lack of a common pattern, indexers and APIs would not be able to easily access this data.

### Alternative 2 — Generics

Another alternative was using templates. The challenge with using templates is that data cannot be partially read without knowing what the template type is. For example, consider an object that might be a token. In resource groups, one could easily read the `Object` or the `Token` resource. In templates, one would need to read the `Object<Token>`. This could also be worked around by complex framework changes and risks around partially reading BCS-encoded data, an application, which has yet to be considered. The same issues in Move would impact those using the REST API.

### Generalizations of Issues

There are myriad combinations between the above two approaches. In general, the drawbacks are

- High costs associated with deserialization and serialization for each read and/or write.
- The current limitations around returning a reference to global memory limit utility of generics and add overheads to reads and writes of objects.
- Limitations on standards resulting in more complexity for API and Indexer usage.
- Data access within models that want to leverage a `struct` with `store`. A `struct` with `key` ability has stricter and more understandable properties than `store`. For example, the latter can lead to data being placed in arbitrary places, complicating global addressing and discoverability, which may be desirable for certain applications.

## Specification

### Within the Framework

A resource group consists of several distinct resources, or a Move `struct` that has the `key` ability.

Each resource group is identified by a common `Move` struct:

```move
#[resource_group(scope = global)]
struct ObjectGroup { }
```

Where this `struct` has no fields and the attribute: `resource_group`. The attribute `resource_group` has the parameter `scope` that limits the location of other entries within the resource group:

- `module` — only resources defined within the same module may be stored within the same resource group.
- `address` — only resources defined within the same address may be stored within the same resource group.
- `global` — there are no limitations to where the resource is defined, any resource can be stored within the same resource group.

The motivation of using a `struct` is that

1. It allows all resources within the group to have a compile time validation that they are within that group
2. It can build upon the existing storage model that knows how to read and write data stored at  `StructTag`s. Thus it limits the implementation impact to the VM and readers of storage, storage can remain agnostic to this change.
3. Only `struct` and `fun` can have attributes, which in turn let’s us define additional parameters like `scope`.

Each entry in a resource group is identified by the `resource_group_member` attribute:

```move
#[resource_group_member(group = aptos_framework::object::ObjectGroup)]
struct Object has key {
    guid_creation_num: u64,
}

#[resource_group_member(group = aptos_framework::object::ObjectGroup)]
struct Token has key {
    name: String,
}
```

During compilation and publishing, these attributes are checked to ensure that:

1. A `resource_group` has no abilities and no fields.
2. The `scope` within the `resource_group` can only become more permissive, that is it can either remain at a remain at the same level of accessibility or increase to the next.
3. Each resource within a resource group has a `resource_group_member` attribute.
4. The `group` parameter is set to a struct that is labeled as a `resource_group`.
5. During upgrade, an existing `struct` cannot either add or remove a `resource_group_member`.

The motivation for each of these requirements are:

1. Ensures that a `resource_group` struct won't be used for other storage purposes. While there is no strict requirement that this be true, it is intended to mitigate confusion to developers.
2. Making a scope less permissive can result in breakage of deployed `resource_group_member`s.
3. Without explicitly labeling a resource `resource_group_member`, there is no way for Move to know that it is within a `resource_group`.
4. Is discussed above as the intent to enforce clean typesafety and a single place to define the properties of the resource group.
5. If there exists data stored wtihin a resource, entering or leaving a resource group can result in that data being inaccessible.

### Within Storage

From a storage perspective, a resource group is stored as a BCS-encoded `BTreeMap<StructTag, BCS encoded MoveValue>`, where a `StructTag` is a known structure in Move of the form: `{ account: Address, module_name: String, struct_name: String }`.  Whereas, a typical resource is stored as a `BCS encoded MoveValue`.

Resource groups introduce a new storage access path: `ResourceGroup` to distinguish from existing access paths. This provides a cleaner interface and segregation of different types of storage. This becomes advantageous to indexers and other direct readers of storage that can now parse storage without inspecting module metadata. Using the example above, `0x1::account::Account` is stored at `AccessPath::Resource(0xcafef00d, 0x1::account::Account)`, whereas the resource group and its contents are stored at `AccessPath::ResourceGroup(0xcafef00d, 0xaa::resource::Group)`

The only way to tell that a resource is within a resource group is by reading the module metadata associated with the resource. After reading module metadata, the storage client should either directly read form the `AccessPath::Resource` or by first reading `AccessPath::ResourceGroup` followed by deserializing the `BTreeMap` and then extracting the appropriate resource.

At write time, an element of a resource group must be appropriately updated into a resource group by determining the delta the resource group as a result of the write operation. This results in the handful of possibilities:

- The resource group doesn’t exist in storage, this is a new write op.
- The resource group already exists, then this is a modification, even if the element is new to the resource group or an element is being removed.
- All the elements have been removed, then this is a deletion.

### Within the Gas Schedule and the VM

The implications for the gas schedule are:

- Reading a single resource from a resource group results in a charge for all the data within a resource group.
- Writing a single resource to a resource group results in a charge for all the data within a resource group.

### Within the Interface

The above text in storage discusses the layout for resources and resources groups. User facing interfaces, such as a REST API, should not be exposed to resource groups. It is entirely a Move concept. A direct read on a resource group should be avoided. A resource group should be flattened and included within a set of resources when reading bulk resources at an address.

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

- Middle of January a complete working model is available.
- Testnet cut is middle of February
- Mainnnet may land as early as middle of March

## References

- [any.move](https://github.com/aptos-labs/aptos-core/blob/main/aptos-move/framework/aptos-stdlib/sources/any.move)
- [simple_map.move](https://github.com/aptos-labs/aptos-core/blob/main/aptos-move/framework/aptos-stdlib/sources/simple_map.move)
- [StructTag](https://github.com/move-language/move/blob/fcb75d8036d81e06bcb6ac102a414590e753579b/language/move-core/types/src/language_storage.rs#L91)
- [Aptos Authenticated Data Structures](https://github.com/aptos-labs/aptos-core/blob/main/documentation/specifications/common/authenticated_data_structures.md)
- [Move Language Book](https://move-language.github.io/move/)
