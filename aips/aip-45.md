---
aip: 45
title: Safe Burning of User-Owned Objects
author: davidiw, movekevin, lightmark, bowenyang007, capcap, kent-white
discussions-to: https://github.com/aptos-foundation/AIPs/issues/232
Status: In Review
type: Standard Framework
created: 08/13/2023
---

# AIP-45 - Safe Burning of User-Owned Objects
  
## Summary

As a byproduct of the objects, users can acquire undesirable and unmovable content associated with their account address on Aptos. Currently, most applications on Aptos will typically share all [Digital Assets](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-11.md) and [Fungible Assets](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-21.md) associated with an account both to the account holder and those viewing the account. Because objects can be rendered undeletable, also known as *soul bound*, a user may be victim to undesired airdrops. To mitigate this issue, we propose leveraging a mechanism that allows users to unilaterally transfer any owned-object to a global burn address.

### Goals

As a result of this AIP, users will be empowered to manage the data associated with their accounts on Aptos by removing direct linkage from undesired data to their account by moving its ownership to a safe burn address. In order to do this, all objects will have the ability to be transferred to the burn address.

If we delay enacting this, users will need to wait until their applications adopt allow-list frameworks to render content.

### Out of Scope

This is only a mitigation, a victim cannot opt-out of receiving unsolicited content nor automatically remove this content. Burning also does not result in the burner receiving a refund, but the cost of doing so is expected to be negligible, that is, the cost of transferring a digital asset.

## Impact

This will impact the following parties:
* Users will be empowered to *burn* object-based assets from their account.
* Smart contract developers will need to be cognizant that even *soul bound* objects can be moved to the burn address.
* The primary fungible asset store for an account may accidentally be transferred away.
* Wallet developers can enable access to a special function to *burn* object-based assets.
* Indexers likely will need to know about the burn address to avoid indexing it as the amount of data there will likely be orders of magnitude greater than any other account.

Note, as this enables primary fungible asset stores owner's to change, the primary fungible asset has access to a special `unburn` function that let's it reclaim ownership in the case that the original owner calls `primary_fungible_store::transfer` or `primary_fungible_store::withdraw`.

## Alternative solutions

1. Allow-lists
  * (+) Allow-lists are the long term solution here as the blockchain grows in popularity, the number of scams and other unsolicited content will grow potentially faster than a user can manage their account. Furthermore, the costs may become prohibitive from cleaning up accounts.
  * (-) Allow-lists require a lot of coordination and management, hence this is a longer term solution that will likely take large ecosystem support to setup.
2. Deletion of user-owned objects
  * (+) This allows a user to reclaim a refund for garbage data that likely exceeds the cost of performing the deletion, which in turn will reduce unnecessary storage load on the blockchain.
  * (-) Some data structures cannot be deleted without potentially breaking applications on the blockchain, for example, a liquidity pool may be entirely broken if the fungible asset metadata were deleted. This could result in valuable assets being permanently locked on-chain without leveraging a governance proposal.

The burn address solution was chosen as it provides a safe means to remove content associated with the users account without potentially breaking other applications.

Note, the current proposal is for an `unburn` function to allow `primary_fungible_store` to reclaim accidentally transferred objects. This could instead be an alternative call into `primary_fungible_store` that explicitly has `unburn`, but that requires that wallets or other applications adopt the `unburn` functionality. The cost for checking the ownership should be negligible as the ownership must be checked prior to extracting assets.

## Specification

The burn address is defined as `0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff` or the largest valid unsigned 256-bit number. Upon acceptance of this AIP, a special Aptos name will be reserved for the burn address.

The following new functions will be added to `aptos_framework::object`:

`public entry fun burn<T: key>(owner: &signer, object: Object<T>)`

This will verify that the `owner` is the actual owner of the object and then update the `ObjectCore::owner` field to the burn address.

`public(friend) entry unburn<T: key>(original_owner: address, object: Object<T>)`

This will verify that the current owner is the burn address and then update the `ObjectCore::owner` field to the `original_owner`.

In `aptos_framework::primary_fungible_store`, the functions `transfers` and `withdraw` will check store ownership prior to transfers and call `object::unburn` if the owner is the burn address.

## Reference Implementation

## Testing 

Thorough Move unit tests including:
* Burning of objects, fungible assets, and digital assets.
* Reclamation of primary fungible asset stores.
* Reclamation of an asset by the owner of a `TransferRef`.
* Ability to delete a burned asset with a `DeleteRef`.

## Risks and Drawbacks

There has been a lot of sentiment shared on the current state of receiving unwanted assets. Frankly speaking, no one wants a noob noob, except movekevin.

This allows *soul bound* assets to effectively be decoupled. As a result, a user can potentially claim multiple *soul bound* assets. Of course, *soul bound* assets likely need to be monitored by an indexer that recognizes that a user may have already received an item even if it is no longer attached to their account.

## Future Potential

The future is a decentralized allow-list managed completely on-chain.

## Timeline

### Suggested implementation timeline

This will be available before the 1.7 branch cut and available for inclusion in an earlier upgrade if the functionality is desired.

### Suggested developer platform support timeline

* SDKs and CLI may be updated to support the burning of objects.
* Indexers should determine whether or not to monitor activity involving the burn address

### Suggested deployment timeline

The minimal expectation is that this should ship as part of the 1.7 framework update.

## Security Considerations

This introduces minimal changes to the system and implies no known security risks.
