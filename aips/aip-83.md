---
aip: 83
title: Framework-level Untransferable Fungible Asset Stores
author: davidiw, 
discussions-to (*optional): <a url pointing to the official discussion thread>
Status: Draft
type: Framework
created: 04/27/2024
updated (*optional): <mm/dd/yyyy>
requires: 21
---

# AIP-82 - Framework-level Untransferable Fungible Asset Stores
  
## Summary

For better control over assets on-chain providers must be able to completely freeze an address from accessing any of the provided asset and not just the existing fungible stores owned by the address.

While the assets within a fungible asset stores can be frozen via `fungible_asset::set_frozen_flag`, that does not prevent the owner of the asset from creating new fungible stores and continue to access assets. This AIP introduces a new `fungible_asset::create_untransferable_store` API that ensures that asset providers can restrict access and offers users of the Aptos framework a unified API to generate all of their asset stores.

### Out of Scope

This is not intended to be a completely general purpose solution as this is not extensible for applications outside of a pure fungible asset store. For example, some asset providers have used fungible asset stores, paired with digital assets to create various new concepts like asset time-locked assets and fungible digital assets. Due to the nature of the required restrictions, this targets only the specific application where a fungible asset store should never be moved.

# High-level Overview

During the creation of a new fungible asset via `add_fungibility`, the creator can also call `set_untransferable`, which will indicate that the underlying `create_store` function cannot be called by external applications and that the only way to create stores is via a new API: `create_untransferable_store`. The store created from `create_untransferable_store` will have the `object::transfer` method revoked to prevent transfers.

If at any point in time, the creator decides to freeze an account, they need only freeze the primary fungible account, creating and freezing one, if it does not exist.

The freeze is enforced during withdraw and deposit. First the asset must be configured to go through alternative transfer functions, by freezing the fungible asset store and using the fungible asset metadata's `TransferRef` to facilitate transfers or by using the dispatchable as discussed in [AIP-73](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-73.md). When the user attempts to transfer, the alternative functions should first acquire the root owner of each provided store and verify that each of the provided stores root owners' primary accounts are not frozen. Only if those conditions are met can a withdraw or deposit occur on provided stores.

## Impact

The changes suggested herein make it easier for a unified approach for building applications that handle arbitrary types of fungible assets. Not approving of this places a burden on each project to instead create their own specialized dispatch for fungible assets that require this logic. This will substantially slow down adoption of assets which require stricter controls as each new asset would require an update to the dispatch table. Besides the maintenance cost, the dispatch table could also become incredibly inefficient over time due to loading too many external modules.

## Alternative solutions

* Require each provider to build their own specialized function and then have each provider build their own dispatch function. As mentioned above this quickly becomes untenable and not scalable.
* Leverage dynamic dispatch of store creation. This is feasible, but we would rather receive feedback on this requirement rather than exposing more dynamic dispatch to the framework at this time. This would likely result in adhoc implementations that might not be secure.

This solution unifies the solution and minimizes code.

## Specification and Implementation Details

This AIP introduces the following new functions:

In `object.move`:
```
public fun root_owner<T: key>(object: Object<T>): address acquires ObjectCore {
    let obj_owner = owner(object);
    while (is_object(obj_owner)) {
        obj_owner = owner(object::address_to_object<ObjectCore>(obj_owner));
    };
    obj_owner
}
```

In `fungible_asset.move`:
```
/// Defnes a fungible asset stores as being untransferable at the object layer.
#[resource_group_member(group = aptos_framework::object::ObjectGroup)]
struct Untransferable has key { }

/// For untransferable stores allow deletion by the root owner.
#[resource_group_member(group = aptos_framework::object::ObjectGroup)]
struct Deletable has key {
    delete_ref: DeleteRef,
}

/// Set that only untransferable stores can be create for this fungible asset.
public fun set_untransferable(constructor_ref: &ConstructorRef) {
    let metadata_addr = object::address_from_constructor_ref(constructor_ref);
    assert!(exists<Metadata>(metadata_addr), error::not_found(EFUNGIBLE_METADATA_EXISTENCE));
    let metadata_signer = &object::generate_signer(constructor_ref);
    move_to(metadata_signer, Untransferable {});
}

/// Creates an untransferable store.
public fun create_untransferable_store<T>(account: &signer, metadata: Object<T>): Object<FungibleStore> {
    let constructor_ref = object::create_object_from_account(account);
    
    // Freeze the object
    let obj_transfer_ref = object::generate_transfer_ref(&constructor_ref);
    object::disable_ungated_transfer(&obj_transfer_ref);
    
    if (object::can_generate_delete_ref(&constructor_ref)) {
        let delete_ref = object::generate_delete_ref(&constructor_ref);
        let store_signer = &object::generate_signer(&constructor_ref);
        move_to(store_signer, Deletable { delete_ref });
    };
    create_store_internal(&constructor_ref, metadata)
}

/// Creates a store on an object during construction.
public fun create_store<T: key>(
    constructor_ref: &ConstructorRef,
    metadata: Object<T>,
): Object<FungibleStore> {
    assert!(is_untransferable(metadata), error::permission_denied(EUNTRANSFERABLE_STORE));
    create_store_internal(constructor_ref, metadata);
}

/// Allows removal of a store by owner if created by `create_untransferable_store`.
public fun remove_my_store<T: key>(account: &signer, store: Object<T>) {
    let obj_addr = object::object_address(&store);
    assert!(exists<Deletable>(obj_addr), error::not_found(EFUNGIBLE_ASSET_DELETABLE));
    assert!(object::root_owner(store) == signer::address_of(account), error::permission_denied(ENOT_OWNER));
    let deletable = move_from<Deletable>(obj_addr);
    remove_store(&deletable.delete_ref);
}

fun create_store_internal<T:key>(
    constructor_ref: &ConstructorRef,
    metadata: Object<T>,
): Object<FungibleStore> {
    let store_obj = &object::generate_signer(constructor_ref);
    move_to(store_obj, FungibleStore {
        metadata: object::convert(metadata),
        balance: 0,
        frozen: false,
    });
    object::object_from_constructor_ref<FungibleStore>(constructor_ref)
}
```

## Reference Implementation

Coming soon.

## Testing (Optional)

All functionality verified with unit tests. We have also devised a realistic example of a fungible asset that leverages this concept and verifies that a frozen account cannot deposit or withdraw assets.

## Risks and Drawbacks

There are no obvious exceptional risks or drawbacks except in terms of considering alternatives.

## Security Considerations

If not implemented correctly, a frozen account could theoretically gain access to a fungible asset that they should otherwise not have access to.

## Future Potential

We look forward to feedback as this feature matures to determine if we need to expose dynamic dispatch for store creation.

## Timeline

This feature should land in main branch by early May 2024. From there, the expectation is to be available in the 1.13 branch.
