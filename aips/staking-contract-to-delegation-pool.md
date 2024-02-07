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
The resulting delegation pool proxies the existing stake pool of the staking contract, hence the operator is unchanged. The commission fee and the beneficiary for operator are instantiated using their values from the staking contract.

It has to be determined whether the staker or operator should be the owner of the new delegation pool. This entity would set the operator and commission fee of the validator from now on.
The staker sets the operator's commission on the staking contract as they are the sole delegator, now when there are multiple delegators, it wouldn't be fair to empower a particular delegator with this capability instead of the operator.

Partial voting is automatically enabled. Previously, the staker could set the delegated voter of the underlying stake pool, implicitly of their owned stake. Now, the staker can vote and delegate their voting power as a regular delegator.

In terms of rewards, there is virtually no impact on the staker, they continue to be rewarded at the same rate as before. In case of the operator, they may expect higher rewards as additional delegators join the pool.

To summarize, state that would not change:
- operator
- commission fee
- beneficiary for operator 
- delegated voter of staker
- individual stakes of staker, operator and any previous operators owning pending-inactive commission

While, the state that would change:
- the pool ownership may be transferred from staker to operator
- the voter of the stake pool is set to the resource account of the delegation pool

## Alternative solutions

As described above, manually converting to a delegation pool requires:
- doubling the infrastructure for a brief period
- rewards downtime
- decreased network security for a brief period

## Specification

`aptos_framework::delegation_pool` implements `initialize_delegation_pool_from_staking_contract(staker: &signer, operator: address)` which is called by `staker` on their staking contract identified by `operator` to atomically convert it, preserving the state of the underlying stake pool, implicitly the activeness of the validator.

## Reference Implementation

There is a reference implementation at https://github.com/bwarelabs/aptos-core/tree/migrate-to-delegation-pool

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
