---
aip:
title: Direct conversion from staking contract to delegation pool
author: alexfilip2/alexandru@bwarelabs.com
discussions-to (*optional):
Status: Draft
last-call-end-date (*optional):
type: Standard (Framework)
created: 02/04/2024
updated (*optional):
requires (*optional):
---

# AIP-X - Direct conversion from staking contract to delegation pool

## Summary
This AIP describes the implementation of an on-chain conversion of a staking contract to a delegation pool. This migration should cause no downtime for the validator and be seamless to the end users.
The ideal conversion should be atomic: destroy the staking contract and, on top of its underlying stake pool, create a delegation pool of consistent stake ownership and configuration.

### Goals

### Out of Scope

## Motivation

This feature enables delegators to spread their stake over the entire validator set and to reach validators of possibly higher uptime. Existing operators of staking contracts would receive additional delegations and become more independent from their stakers that could decide to leave the protocol at any time.

## Impact
The resulting delegation pool proxies the existing stake pool of the staking contract.

The operator is a config of the underlying stake pool, and thus it remains unchanged.

The commission fee from the staking contract is preserved. However, changing the commission fee will apply from the next lockup cycle from now on.

The pool ownership is preserved, the staker becomes owner of the delegation pool and can set the operator and commission fee as before.

Partial voting is automatically enabled. Previously, the staker could set the delegated voter of the underlying stake pool, implicitly of their owned stake. Now, the staker can vote and delegate their voting power as a regular delegator.

If the beneficiary of operator is not configured on `aptos_framework::delegation_pool`, then it cannot be initialized as the conversion function doesn't have access to operator's signer, only to staker's. The default beneficiary will be used which is the operator themselves.
If the beneficiary is already set, then this address will be used for the new delegation pool as well.

In terms of rewards, there is virtually no impact on the staker, they continue to be rewarded at the same rate as before. In case of the operator, they may expect higher rewards as additional delegators join the pool.

Staker's delegated voter (stake pool's voter) is preserved and applies immediately. However, delegating voting power will apply from the next lockup cycle from now on.

To summarize, state that will be preserved:
- pool ownership
- operator
- commission fee
- delegated voter of staker
- individual stakes of staker, operator and any previous operators still owning pending-inactive commission

While, state that will change:
- the voter of the stake pool is set to the resource account of the delegation pool
- beneficiary of operator: address already applying on delegation-pool module will be used

## Alternative solutions

The legacy staking contract cannot be directly converted to a delegation pool. The staker should unlock their entire stake from the staking contract and then delegate it to a newly created delegation pool.
This results in downtime for the validator, leading to missed rewards and a temporary decrease in network's security.
Furthermore, the operator needs to setup an extra validator node that must be synced at the time of staker's delegation (in order to achieve the least possible downtime).

As described above, manually converting to a delegation pool requires:
- doubling the infrastructure for a brief period
- rewards downtime
- decreased network security for a brief period

## Specification

`aptos_framework::delegation_pool` implements `initialize_delegation_pool_from_staking_contract(staker: &signer, operator: address)` which is called by `staker` on their staking contract identified by `operator` to atomically convert it, preserving the state of the underlying stake pool, implicitly the activeness of the validator.

`aptos_framework::staking_contract` implements `destroy_staking_contract(staker: &signer, operator: address)` which will only be called by `aptos_framework::delegation_pool::initialize_delegation_pool_from_staking_contract`. This function destroys the `StakingContract` between `staker` and `operator` and returns the resource account storing the stake pool and the ownership capability.

`destroy_staking_contract`:
- extracts the `staking_contract::StakingContract` between *staker* and *operator* from the `staking_contract::Store` of *staker*
- `distribute_internal` any existing *inactive* stake to *staker*, *operator* and any previous operators that still own some
- `request_commission_internal` to allocate in-flight commission to *operator* in `StakingContract.distribution_pool` as *pending-inactive* stake
- destructs `StakingContract` resource and returns its contents:
    * `principal`: amount of *active* stake owned by *staker* after paying out commission to *operator* at the `request_commission_internal` step
    * `pool_address`: address of resource account storing the stake pool (`stake::StakePool`)
    * `owner_cap`: `stake::OwnerCapability` over the stake pool
    * `commission_percentage` of *operator* on this staking contract
    * `distribution_pool` tracking *pending-inactive* commission of *operator* (updated at the `request_commission_internal` step) and any previous operators + any stake unlocked by *staker*
    * `signer_cap`: `account::SignerCapability` of resource account storing the stake pool
- emits `DestroyStakingContractEvent(staker, operator)`

`staking_contract::BeneficiaryForOperator` is a global config of *operator* within the `staking_contract` module and should not be destroyed.

`initialize_delegation_pool_from_staking_contract`:
- checks that the conversion feature is enabled
- checks that *staker* doesn't already own a delegation pool
- checks that there is no *pending-active* stake in order to avoid charging *staker* the *add-stake fee*
- `destroy_staking_contract` and take ownership of `StakingContract`'s contents
- converts `commission_percentage` to a 2-decimals precision format used within `delegation_pool` module
- stores `owner_cap` on the resource account of `signer_cap`
- creates the `delegation_pool::DelegationPool` resource:
    * initialize `active_shares` and `inactive_shares` shares pools
    * initialize `observed_lockup_cycle`
    * initialize `pending_withdrawals`
    * set `stake_pool_signer_cap` to `signer_cap`
    * set `operator_commission_percentage` to `commission_percentage`
    * set `total_coins_inactive` to 0: `distribute_internal` call ensures there is no *inactive* stake to be accounted for
- allocates *active* shares, equivalent to `principal`, to *staker* in `active_shares` pool
- allocates *pending-inactive* shares to each shareholder of `distribution_pool` in `inactive_shares(0)` pool
- stores `DelegationPool` resource on the resource account of `signer_cap` also storing `StakePool`
- stores `DelegationPoolOwnership` capability on *staker*
- sets delegated voter of *staker* to their previous voter on the staking contract without waiting a lockup cycle to end on the stake pool

`delegation_pool::BeneficiaryForOperator` could not have been created + published because *operator*'s signer is inaccessible.
If the *operator* already has a beneficiary set for their delegation pools then use that address, otherwise *operator*'s address will be used by default.

New events have been added in order to track down the conversion:
- `staking_contract::destroy_staking_contract`:
```
    struct DestroyStakingContractEvent has drop, store {
        staker: address,
        operator: address,
    }
```
to identify a particular staking contract being destroyed
- `delegation_pool::initialize_delegation_pool_from_staking_contract`:
```
    struct InitializeDelegationPoolFromStakingContract has drop, store {
        staker: address,
        operator: address,
        pool_address: address,
        principal: u64,
        operator_commission_percentage: u64,
    }
```
to notify that a new delegation pool has been created out of a staking contract of particular state and configs
```
    struct DistributePendingInactiveStakeFromStakingContract has drop, store {
        pool_address: address,
        recipient: address,
        amount: u64,
    }
```
to log each each individual distribution of *pending-inactive* stake to shareholders of the destroyed staking contract

## Reference Implementation

There is a reference implementation at https://github.com/bwarelabs/aptos-core/tree/convert-staking-contract-to-delegation-pool

## Testing (Optional)

Design UTs to validate that:
- there is no remaining state of the staking contract while the underlying stake pool remains untouched
- the post-conversion state is consistent
- the resulted delegation pool accepts delegations, staker is treated as a regular delegator and the commission is correctly distributed

## Risks and Drawbacks

The beneficiary of operator is set to a possibly different address than the one used on the staking contract without operator's approval. This address is either the one already configured on the delegation-pool module or the operator themselves, which is an address still owned by the operator.

## Future Potential

All existing staking contracts would be converted to delegation pools and create a homogenous validator landscape.

## Timeline

### Suggested implementation timeline

### Suggested developer platform support timeline

The conversion is a one-time process that could be executed through a wallet connected to the Aptos explorer or via CLI.

### Suggested deployment timeline

## Security Considerations

If the conversion can be executed only by the staker, they might decide to not proceed with it, thereby preventing the operator from acquiring additional stake.

## Open Questions (Optional)
