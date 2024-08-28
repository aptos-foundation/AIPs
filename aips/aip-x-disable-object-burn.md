---
aip: (this is determined by the AIP Manager, leave it empty when drafting)
title: Disable Object Burn
author: gregnazario (greg@aptoslabs.com)
discussions-to (*optional): <a url pointing to the official discussion thread>
Status: Draft
last-call-end-date (*optional): <mm/dd/yyyy the last date to leave feedbacks and reviews>
type: Standard (Framework)
created: 8/28/2024
updated (*optional):
requires (*optional):
---

# AIP-X - Disable Safe Burn of User-Owned Objects

## Summary

Safe burn was originally described in [AIP-45](./aip-45.md), which allowed users to tombstone their objects and remove
direct linkage of an undeletable, also known as *soulbound*, object to an account. This AIP seeks to disable safe
object burn, as it caused extra complexity, and sometimes unexpected consequences. Owners of burned objects will still
be able to unburn and recover their tombstoned objects.

### Goals

As a result of this AIP, users will still be able to unburn their burnt objects, but will not be able to burn any new
undeletable objects. This will reduce complexity and some interesting edge cases associated.

If we delay enacting this, there may be more burnt objects, which could cause more unexpected behaviors around moving
burnt objects to the burn address.

### Out of Scope

This removes the previous mitigation, since users cannot opt-out of receiving unsolicited content. Wallets or other
platforms will need to come up with a standardized way of hiding unwanted items.

Additionally, we will not be preventing unburning existing burnt objects at this time.

## Motivation

The purpose here is to remove burn to prevent confusion, and complexity around *soulbound* objects changing owners.
Originally, this was meant mostly for being able to hide unwanted *soulbound* NFTs. But, there are more use cases for
*soulbound* objects (e.g. primary fungible store), which can complicate functionality around them. Removing this
functionality simplifies cases for builders, and can make it easier to accomplish things like allowlists on fungible
assets.

If we do not accept this proposal, some functionality around *soulbound* objects will require extra complexity or even
may not be able to work around burns.

## Impact

This impacts the following parties:

* Users who have already burnt, or plan to burn owned *soulbound* objects
* Smart contract developers who use the `burn` or `unburn` functionality

## Alternative solutions

No other alternative solutions.

## Specification

All calls to `aptos_framework::object::burn` will now abort with error code `EBURN_NOT_ALLOWED = 10`. Additionally, the
function will be marked as `#[deprecated]` and all inputs prefixed with `_` to mark as unused.

```move
module aptos_framework::object {
    #[deprecated]
    public entry fun burn<T: key>(_owner: &signer, _object: Object<T>) {
        abort EBURN_NOT_ALLOWED
    }
}
```

Unburn will still be untouched and allowed to be called by users on burnt objects.

The following new functions will be added to `aptos_framework::object`:

```move
module aptos_framework::object {
  #[test_only]
  public fun burn_object<T: key>(owner: &signer, object: Object<T>) {}
}
```

This will contain the previous implementation of `aptos_framework::object::burn` for purposes of testing with burnt
objects.

## Reference Implementation

Full implementation is complete here, with Move Prover
specifications https://github.com/aptos-labs/aptos-core/pull/14443

## Testing (Optional)

All existing Move unit tests, with the new `#[test_only]` function, to ensure `unburn` still works properly, as well as

* Move Prover specification checking new burn abort behavior
* Move Prover specification checking test only behavior matches previous burn behavior
* Move unit test checking new burn abort behavior

## Risks and Drawbacks

The previous [AIP-45](./aip-45.md) captured the main risks of having the AIP, including having unwanted *soulbound*
NFTs. Additionally, if any smart contracts built around the `burn` function, it is possible they would stop working.

However, given that `burn` is just essentially moving an object to a different address with a Tombstone, there should be
nearly no risk associated with removing this functionality.

This still allows users to `unburn` already burnt objects, meaning that users will still have access to items they had
burnt previously.

## Security Considerations

The result of this AIP should strictly be more secure than allowing `burn`s. Burns move objects to be owned by a burn
address, which can cause some unwanted side effects around allowlisting by owner. By ensuring that the object is always
owned by the original owner, it should mitigate any issues there.

## Future Potential

The future is that wallets should provide their own allowlisting of which assets to show, or provide a decentralized
allowlist of which assets to show in a wallet.

## Timeline

### Suggested implementation timeline

The expectation is that this should ship as part of the next release after being approved.

### Suggested developer platform support timeline

One day of work, to remove `burn` from any documentation on the [aptos.dev](https://aptos.dev) website.

### Suggested deployment timeline

Deployed as the next applicable framework release, after being approved.

## Open Questions (Optional)

None
