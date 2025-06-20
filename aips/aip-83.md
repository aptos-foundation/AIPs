---
aip: 83
title: Framework-level Untransferable Objects
author: davidiw, 
discussions-to (*optional): <a url pointing to the official discussion thread>
Status: Accepted
type: Framework
created: 04/27/2024
updated (*optional): <mm/dd/yyyy>
requires: 21
---

# AIP-83 - Framework-level Untransferable Fungible Asset Stores
  
## Summary

The Aptos object model offers an extensible data model that allows an object to masquerade as many distinct types. For example, an object can be both a fungible asset as well as a digital asset. Some asset classes have need for greater control as a result the existing framework is at odds with their goals. Specifically, many APIs expose adding new objects via the `ConstructorRef`, but the `ConstructorRef` can also be used to enable new transfer policies. As a result, there is currently no method to enforce certain transfer policies in the existing object model. This AIP introduces the first step toward providing greater control by offer a new method for constructing objects called `object::set_untransferable` that ensures that the object owner is set permanently regardless of any operations performed on the object during or after its creation.

The specific application that comes to mind is fungible assets, wherein a fungible asset stores can be frozen via `fungible_asset::set_frozen_flag`, however, that does not prevent the owner of the asset from sending and receiving new fungible stores and continue to access assets.

### Out of Scope

Longer term, it would be ideal to explore the concept of allowing a single object be more explicit about the allowed transfer rules. Perhaps that's more in exposing a dispatchable object transfer model, but that is outside the scope of this AIP.

# High-level Overview

During the creation of an object, any code with access to the `ConstructorRef` can call `object::set_untransferable` that will prevent any calls to `object::transfer` and `object::transfer_with_ref`. Similar functionality will be add to fungible asset metadata to indicate that stores created for a specific fungible asset should be made untransferable: `fungible_asset::set_untransferable`. Then all calls to `fungible_asset::create_store` for that metadata will by proxy call `object::set_untransferable`.

As a result of this if the creator decides to freeze an account, they need only freeze the primary fungible account, creating and freezing one, if it does not exist.

The freeze is enforced during withdraw and deposit. First the asset must be configured to go through alternative transfer functions, by freezing the fungible asset store and using the fungible asset metadata's `TransferRef` to facilitate transfers or by using the dispatchable as discussed in [AIP-73](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-73.md). When the user attempts to transfer, the alternative functions should first acquire the root owner of each provided store and verify that each of the provided stores root owners' primary accounts are not frozen. Only if those conditions are met can a withdraw or deposit occur on provided stores.

This AIP also introduces a method to obtain the ultimate owner of an object due to the nested nature of objects in Aptos. That is a fungible asset store may be indirectly owned by a frozen account. `object::root_owner` is being introduced to determine the highest or ultimate owner of an object. This can then be used to evaluate properties associated with that identity.

## Impact

The changes suggested herein make it easier for a unified approach for building applications that handle arbitrary types of objects and fungible assets. Not approving of this places a burden on each project to instead create their own specialized dispatch for objects that require this logic. This will substantially slow down adoption of objects that require stricter controls as each new asset would require an update to the dispatch table. Besides the maintenance cost, the dispatch table could also become incredibly inefficient over time due to loading too many external modules.

## Alternative solutions

* Require each provider to build their own specialized function and then have each provider build their own dispatch function. As mentioned above this quickly becomes untenable and not scalable.
* Leverage dynamic dispatch of store creation. This is feasible, but we would rather receive feedback on this requirement rather than exposing more dynamic dispatch to the framework at this time. This would likely result in adhoc implementations that might not be secure.
* Build Fungible Asset Store specific logic. While feasible, it seems like having this logic at the core both simplifies the design and allows `create_store` to provide a consistent developer experience for those assets that need to be nontransferable.

This solution unifies the solution and minimizes code.

## Specification and Implementation Details

This AIP introduces the following new functions:

In `object.move`:
```
#[resource_group_member(group = aptos_framework::object::ObjectGroup)]
struct Immovable has key {}

public fun set_untransferable(ref: &ConstructorRef) acquires ObjectCore {
    let object = borrow_global_mut<ObjectCore>(ref.self);
    object.allow_ungated_transfer = false;
    let object_signer = generate_signer(ref);
    move_to(&object_signer, Untransferable {});
}

public fun root_owner<T: key>(object: Object<T>): address acquires ObjectCore {
    let obj_owner = owner(object);
    while (is_object(obj_owner)) {
        obj_owner = owner(object::address_to_object<ObjectCore>(obj_owner));
    };
    obj_owner
}

public fun enable_ungated_transfer(ref: &TransferRef) acquires ObjectCore {
    assert!(!exists<Immovable>(ref.self), error::permission_denied(ENOT_MOVABLE));
    ...

public fun generate_linear_transfer_ref(ref: &TransferRef): LinearTransferRef acquires ObjectCore {
    assert!(!exists<Immovable>(ref.self), error::permission_denied(ENOT_MOVABLE));
    ...


public fun transfer_with_ref(ref: LinearTransferRef, to: address) acquires ObjectCore {
    assert!(!exists<Immovable>(ref.self), error::permission_denied(ENOT_MOVABLE));
    ...
```

In `fungible_asset.move`:
```
#[resource_group_member(group = aptos_framework::object::ObjectGroup)]
struct Untransferable has key {}

/// Set that only untransferable stores can be create for this fungible asset.
public fun set_untransferable(constructor_ref: &ConstructorRef) {
    let metadata_addr = object::address_from_constructor_ref(constructor_ref);
    assert!(exists<Metadata>(metadata_addr), error::not_found(EFUNGIBLE_METADATA_EXISTENCE));
    let metadata_signer = &object::generate_signer(constructor_ref);
    move_to(metadata_signer, Untransferable {});
}

public fun is_untransferable<T: key>(metadata: Object<T>): bool {
    exists<Untransferable>(object::object_address(&metadata))
}

public fun create_store<T: key>(
    constructor_ref: &ConstructorRef, 
    metadata: Object<T>,
): Object<FungibleStore> {
    if (is_immovable(metadata)) {
        object::set_immovable(constructor_ref);
    };
    ...
```

## Reference Implementation

https://github.com/aptos-labs/aptos-core/pull/13175

## Testing (Optional)

All functionality verified with unit tests. We have also devised a realistic example of a fungible asset that leverages this concept and verifies that a frozen account cannot deposit or withdraw assets.

## Risks and Drawbacks

It is possible that a module that creates objects via `ConstructorRef` introduces this new functionality rendering dependent modules invalid. of course, the those modles that create or manipulate objects can also break themselves arbitrarily.

## Security Considerations

If not implemented correctly, a frozen account could theoretically gain access to a fungible asset that they should otherwise not have access to.

## Future Potential

We look forward to feedback as this feature matures to determine if we need to expose dynamic dispatch for store creation.

## Timeline

This feature should land in main branch by early May 2024. From there, the expectation is to be available in the 1.13 branch.
