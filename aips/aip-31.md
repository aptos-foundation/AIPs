---
aip: 31
title: Allow listing for delegation pools
author: junkil-park, movekevin, michelle-aptos, wintertoro, alexfilip2
discussions-to: https://github.com/aptos-foundation/AIPs/issues/121
Status: In Review
last-call-end-date (*optional): <mm/dd/yyyy the last date to leave feedbacks and reviews>
type: Framework
created: 5/3/2023
updated: 4/16/2024
---

# AIP-31 - Allowlisting for delegation pools

## Summary

This AIP introduces the concept of allowlisting in delegation pools, allowing pool owners to control who can stake in their delegation pool. The feature includes mechanisms for adding or removing delegators from the allowlist and evicting delegators not on the allowlist.

## High-level overview

Currently, all the delegation pools are permissionless, meaning that any staker can stake to any delegation pool. However, for various reasons such as compliance, some delegation pools may prefer to operate on a permissioned basis, restricting staking to only those from an allowlist of wallet addresses. This feature will enable pool owners to establish an allowlist, controlling who can stake in their delegation pool.

## Impact

This feature impacts several aspects:

* Pool owners: Pool owners can set an allowlist for their delegation pool. They can add or remove addresses from the allowlist and evict delegators who are not on the allowlist.

* Delegators: If a delegation pool has enabled allowlisting, the delegators who are not on the allowlist are unable to add stake or reactivate stake in the pool. The delegators can also be evicted from the pool by the pool owner, resulting in their stake becoming unlocked. The evicted delegator can then withdraw their unlocked fund.

* Staking UI: The staking user interface (UI) will need updates to display the allowlisting status of delegation pools and the corresponding status of delegators.

## Specification and Implementation Details

### Specification
Here are the specifications:
1. By default, a delegation pool is permissionless and does not have an allowlist. The pool owner can set an allowlist, transitioning the pool to a permissioned state.
2. When an allowlist is first established in a delegation pool, it starts empty. This initial empty allowlist does not impact existing stakes in the pool. However, the pool will not accept any new stakes or reactivation of pending-inactive stakes from any stakers because no one is on the allowlist initially.
3. The pool owner may add stakers' wallet addresses to the allowlist. Once an address is added, the staker can add new stakes or reactivate existing stakes in the pool. Note that this feature does not facilitate a mechanism for stakers to request to be added to the allowlist; such requests must be managed off-chain (e.g., through private communication between the operator and staker, or UI-based solutions).
4. If a delegator is removed from the allowlist, they are no longer able to add or reactivate stakes. However, they retain the ability to unlock and withdraw their existing stakes.
5. The pool owner can evict a delegator who is not included on the allowlist. This action will unlock the delegator's entire stake, transitioning all of their active stakes to a pending inactive state. As the evicted delegator is not on the allowlist, they cannot reactive their stake. Note that these tokens will remain locked up until the end of the lockup period, and the existing stake will also continue to earn rewards until then. When the lockup period ends, the funds will be unstaked (inactive), but will remain in the pool until the delegator initiates a withdrawal.
6. If a delegator's stake enters the pending inactive state due to eviction, the pool owner can subsequently add the delegator back to the allowlist. However, this action will not automatically reactivate the stake. Automatic reactivation is not provided to prevent potential misuse by a malicious pool owner who might repeatedly evict and re-allowlist a delegator to prevent them from leaving the pool. Once a delegator is back on the allowlist, the delegator must manually call the `reactivate_stake` function to reactivate their stake.
7. Delegation pools that have enabled allowlisting can disable it. When disabled, the delegation pool becomes permissionless, allowing any staker to stake to the pool.
8. This AIP does not incorporate a blacklisting function, where all stakes are allowed except those on a blacklist. The rationale is that individuals behind blacklisted addresses can easily circumvent this by creating new account addresses.

### Implementation Details

The allowlist is implemented as a smart table whose encompassing resource will be published under the pool address. The smart table will store the allowlist of addresses and a boolean value indicating whether the address is on the allowlist. The smart table will be defined as follows:
```
struct DelegationPoolAllowlisting has key {
    allowlist: SmartTable<address, bool>,
}
```

A pool owner constructs the allowlist for their delegation pool by interacting with the `aptos_framework::delegation_pool` module. An account can own only one delegation pool, therefore, its signer uniquely identifies the pool it owns. Here are the entry functions that are added to the `aptos_framework::delegation_pool` module:
- `enable_delegators_allowlisting(owner: &signer)`: enables allow listing and creates an empty allowlist
- `disable_delegators_allowlisting(owner: &signer)`: disables allow listing and deletes the existing allowlist, pool becomes permissionless
- `allowlist_delegator(owner: &signer, address)`: adds an address to the allowlist, fails if allow listing is not enabled
- `remove_delegator_from_allowlist(owner: &signer, address)`: removes an address from the allowlist, fails if allow listing is not enabled
- `evict_delegator(owner: &signer, address)`: evicts a delegator from the pool by *unlocking* their entire stake, fails if allow listing is not enabled or delegator is allowlisted

These are the view functions that are added to the `aptos_framework::delegation_pool` module:
- `allowlisting_enabled(pool: address)`: returns whether `pool` has allow listing enabled
- `delegator_allowlisted(pool: address, delegator: address)`: returns whether `delegator` is allowlisted on `pool`
- `get_delegators_allowlist(pool: address)`: returns the allowlist defined on `pool`, fails if allow listing is not enabled

Several event types are defined to notify about changes in the allowlist:
```
#[event]
struct EnableDelegatorsAllowlisting has drop, store {
    pool_address: address,
}

#[event]
struct DisableDelegatorsAllowlisting has drop, store {
    pool_address: address,
}

#[event]
struct AllowlistDelegator has drop, store {
    pool_address: address,
    delegator_address: address,
}

#[event]
struct RemoveDelegatorFromAllowlist has drop, store {
    pool_address: address,
    delegator_address: address,
}

#[event]
struct EvictDelegator has drop, store {
    pool_address: address,
    delegator_address: address,
}
```

## Reference Implementation

https://github.com/aptos-labs/aptos-core/pull/12213

## Testing

The reference implementation includes multiple unit test cases covering various scenarios. These scenarios will be tested on the testnet using an active delegation pool established there.

## Risks and Drawbacks

Pool owners are unable to evict a delegator holding exactly 10 APT as active stake, due to the minimum stake requirement for active and pending-inactive stake per delegator being 10 APT. When attempting to unlock, rounding errors caused by the "active to pending-inactive" conversion could reduce the stake to slightly less than 10 APT, causing the unlock function to revert. However, unless the validator is inactive, rewards will continue to accrue on the delegator's active stake, increasing it above 10 APT. Once the active balance exceeds 10 APT, the pool owner can proceed with the eviction.

## Future Potential

This feature may be a requirement for any exchanges, financial institutions, or other entities that want to run a validator using a permissioned delegation pool.

## Timeline

### Suggested implementation timeline
The implementation has landed on the `main` branch and the branch for v1.11.

### Suggested developer platform support timeline
The staking UI change will be implemented in the developer platform before this feature is enabled on the mainnet.

### Suggested deployment timeline
* On the devnet: with release 1.11
* On the testnet and mainnet: depends on the timeline of the developer platform support, specifically the staking UI update.
