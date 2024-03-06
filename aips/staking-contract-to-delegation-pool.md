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

The legacy staking contract cannot be directly converted to a delegation pool. The staker should unlock their entire stake from the staking contract and then delegate it to a newly created delegation pool.
This results in downtime for the validator, leading to missed rewards and a temporary decrease in network's security.
Furthermore, the operator needs to setup an extra validator node that must be synced at the time of staker's delegation (in order to achieve the least possible downtime).

The ideal conversion should be atomic: destroy the staking contract and, on top of its underlying stake pool, create a delegation pool of consistent stake ownership and configuration.

### Goals

### Out of Scope

## Motivation

This feature enables delegators to spread their stake over the entire validator set and to reach validators of possibly higher uptime. Existing operators of staking contracts would receive additional delegations and become more independent from their stakers that could decide to leave the protocol at any time.

## Impact
The resulting delegation pool proxies the existing stake pool of the staking contract.

The operator is a config of the underlying stake pool, and thus it remains unchanged.

The commission fee from the staking contract is preserved. Changing the commission fee will apply from the next lockup cycle from now on.

The pool ownership is preserved, the staker becomes owner of the delegation pool and can set the operator and commission fee as before.

Partial voting is automatically enabled. Previously, the staker could set the delegated voter of the underlying stake pool, implicitly of their owned stake. Now, the staker can vote and delegate their voting power as a regular delegator.

If the beneficiary of operator is not set on `aptos_framework::delegation_pool`, then it cannot be initialized as the conversion function doesn't have access to operator's signer, only to staker's. The default beneficiary will be used which is the operator themselves.
If the beneficiary is already set, then this address will be used for the new delegation pool as well.

In terms of rewards, there is virtually no impact on the staker, they continue to be rewarded at the same rate as before. In case of the operator, they may expect higher rewards as additional delegators join the pool.

Staker's delegated voter (stake pool's voter) is preserved and applies immediately. Delegating voting power will apply from the next lockup cycle from now on.

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

As described above, manually converting to a delegation pool requires:
- doubling the infrastructure for a brief period
- rewards downtime
- decreased network security for a brief period

## Specification

`aptos_framework::delegation_pool` implements `initialize_delegation_pool_from_staking_contract(staker: &signer, operator: address)` which is called by `staker` on their staking contract identified by `operator` to atomically convert it, preserving the state of the underlying stake pool, implicitly the activeness of the validator.

`aptos_framework::staking_contract` implements `destroy_staking_contract(staker: &signer, operator: address)` which will only be called by `aptos_framework::delegation_pool::initialize_delegation_pool_from_staking_contract`. This function destroys the `StakingContract` between `staker` and `operator` and returns the resource account storing the stake pool and the ownership capability.

## Reference Implementation

There is a reference implementation at https://github.com/bwarelabs/aptos-core/tree/convert-staking-contract-to-delegation-pool

## Testing (Optional)

Design UTs to validate that:
- there is no remaining state of the staking contract while the underlying stake pool remains untouched
- the post-conversion state is consistent
- the resulted delegation pool accepts delegations, staker is treated as a regular delegator and the commission is correctly distributed

## Risks and Drawbacks

Transferring the ability to set the operator commission from the staker to the operator could alter the terms of their previous agreement.

## Future Potential

All existing staking contracts would be converted to delegation pools and create a homogenous validator landscape.

## Timeline

### Suggested implementation timeline

### Suggested developer platform support timeline

The conversion is a one-time process that could be executed through a wallet connected to the Aptos explorer or via CLI.

### Suggested deployment timeline

## Security Considerations

If the conversion can be executed only by the staker, they might decide to not proceed with it, thereby preventing the operator from acquiring additional stake.

The staker loses the capability to set the commission fee and would have to leave the pool if the commission fee is changed against their will.

## Open Questions (Optional)
