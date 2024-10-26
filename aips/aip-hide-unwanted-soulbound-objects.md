---
aip: (this is determined by the AIP Manager, leave it empty when drafting)
title: Hide Unwanted Soulbound Objects
author: gregnazario (greg@aptoslabs.com)
discussions-to (*optional): <a url pointing to the official discussion thread>
Status: <Draft | Last Call | Accepted | Final | Rejected>
last-call-end-date (*optional): <mm/dd/yyyy the last date to leave feedbacks and reviews>
type: <Standard (Core, Networking, Interface, Application, Framework) | Informational | Process>
created: <mm/dd/yyyy>
updated (*optional): <mm/dd/yyyy>
requires (*optional): <AIP number(s)>
---

# AIP-XX - Hide Unwanted Soulbound Objects

## Summary

Safe burn was originally described in [AIP-45](./aip-45.md), which allowed users to tombstone their objects and remove
direct linkage of an undeletable, also known as *soulbound*, object to an account. [AIP-99](./aip-99.md) that 
functionality was disabled due to complexities around moving objects to the burn address on those implementing owner
based allowlists.  This AIP seeks to add back the ability to TombStone objects, but purely for the purposes of hiding
objects from view.  It was the main goal behind AIP-45, and this AIP will bring back that functionality.

### Goals

As a result of this AIP, users will be able to burn objects by adding a TombStone to their object.  This will allow
users to hide spam, or unwanted items from their account.  Then, all indexers, wallets, explorers, etc. will not show
it to the user, unless they specifically request to see it.  This will allow users to have a cleaner UX for users and
allow them to hide unwanted items in a decentralized persistent way.

If we delay enacting this, users may have their wallets full of soulbound junk NFTs or fungible assets that they do not
choose to see.

### Out of Scope

Users and products that choose not to implement or use an indexer that implements the TombStone as a way to hide objects
will not change their UX.  Since this is fully decentralized, if it's not adopted by them, they will not see the benefits.

## Motivation

The purpose here is to provide the original intent of AIP-45, which was to allow users to hide unwanted items from their
wallets.  This will allow users to have a cleaner UX, and not have to see unwanted items.

If we do not accept this proposal, users will not be able to hide unwanted items across all of their interfaces at once
and instead would have to do it on every single wallet or interface they use.

## Impact

This impacts the following parties:

* Builders who built products that want to allow users to hide unwanted items
* Indexers that index objects or NFTs and show them to users
* Users who plan to burn owned *soulbound* objects
* Smart contract developers who use the `burn` or `unburn` functionality

This does not impact the following parties:

* Users who have already burnt owned *soulbound* objects. They still can unburn them.

## Alternative solutions

The alternative solution, would be to have a standard way to hide objects, but this would require likely each product to
implement their own way of hiding objects.  Each wallet e.g. Petra, Pontem and each marketplace e.g. Tradeport, Wapal,
would need to hide them individually.

## Specification

Functionality for `aptos_framework::object::burn` will be re-enabled, but only for the purposes of hiding objects.  This
means it removes the final line to move the object to the burn address, and instead just adds a TombStone to the object.

```move
module aptos_framework::object {
    public entry fun burn<T: key>(owner: &signer, object: Object<T>) acquires ObjectCore {
        let original_owner = signer::address_of(owner);
        assert!(is_owner(object, original_owner), error::permission_denied(ENOT_OBJECT_OWNER));
        let object_addr = object.inner;
        move_to(&create_signer(object_addr), TombStone { original_owner });
    }
}
```

Unburn will still be changed and allowed to be called by users on burnt objects of either the old way or the new way.  As
long as the user is the direct owner of the object, or the burn address is the direct owner.

```move
module aptos_framework::object {
    public entry fun unburn<T: key>(
        original_owner: &signer,
        object: Object<T>,
    ) acquires TombStone, ObjectCore {
        let object_addr = object.inner;
        assert!(exists<TombStone>(object_addr), error::invalid_argument(EOBJECT_NOT_BURNT));

        // The new owner of the object can always unburn it, but if it's the burn address, we go to the old functionality
        let object_core = borrow_global<ObjectCore>(object_addr);
        if (object_core.owner == signer::address_of(original_owner)) {
            let TombStone { original_owner: _ } = move_from<TombStone>(object_addr);
        } else if (object_core.owner == BURN_ADDRESS) {
            // The old functionality
            let TombStone { original_owner: original_owner_addr } = move_from<TombStone>(object_addr);
            assert!(
                original_owner_addr == signer::address_of(original_owner),
                error::permission_denied(ENOT_OBJECT_OWNER)
            );
            transfer_raw_inner(object_addr, original_owner_addr);
        } else {
            abort error::permission_denied(ENOT_OBJECT_OWNER);
        };
    }
}
```
The following new functions will be added to `aptos_framework::object`:

```move
module aptos_framework::object {
    #[test_only]
    public fun burn_object_with_transfer<T: key>(owner: &signer, object: Object<T>) {}
}
```

This will contain the previous implementation of `aptos_framework::object::burn` for purposes of testing with burnt
objects.

TODO: Indexer specification

## Reference Implementation

Full implementation is complete here, with Move Prover
specifications https://github.com/aptos-labs/aptos-core/pull/15095

## Testing (Optional)

All existing Move unit tests, with the new `#[test_only]` function, to ensure `unburn` still works properly, as well as

* Move Prover specification checking new burn behavior
* Move Prover specification checking test only behavior matches previous burn behavior
* Move unit test checking new burn behavior

## Risks and Drawbacks

The previous [AIP-45](./aip-45.md) captured the main risks of having the AIP, including having unwanted *soulbound*
NFTs. Additionally, if any smart contracts built around the `burn` function moving to the burn address, it is possible 
they would stop working.

However, given that `burn` is now just adding Tombstone, there should be
nearly no risk associated with adding this functionality.

This still allows users to `unburn` already burnt objects, meaning that users will still have access to items they had
burnt previously.

## Security Considerations

The result of this AIP should ensure that always the owner can unburn the object.  If the object is not at the burn
address of 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff, then the original owner forfeits their
right to unburn the object.  This should ensure that the object is always owned by the original owner, and that users
cannot transfer unburned objects, and then get them back somehow.  Given the *soulbound* objects are not transferable,
even in a burn scenario, there should be no more security issues than there were before.

## Future Potential

## Timeline

### Suggested implementation timeline

The expectation is that this should ship as part of the next release after being approved.

### Suggested developer platform support timeline

* Add back `burn` in any documentation on the [aptos.dev](https://aptos.dev) website.  And explain how the indexers must support it.

### Suggested deployment timeline

## Open Questions (Optional)

* None
