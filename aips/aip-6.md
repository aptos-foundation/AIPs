---
aip: 6
title: Delegation pool for node operators
author: alexfilip2/alexandru@bwarelabs.com
discussions-to: https://github.com/aptos-foundation/AIPs/issues/20
Status: Draft
last-call-end-date (*optional):
type: Standard (framework)
created: 12/16/2022
---

## Summary

Currently, only token owners with 1M APT are able to stake their tokens and earn staking rewards. We want to enable everyone in the community to have access to staking rewards as well. We propose adding a delegation contract to the framework. This extension enables multiple token owners to contribute any amount of APT to the same permissionless delegation pool. As long as the total amount of APT in a delegation pool meets the minimum stake required for staking, the validator node on which it is set on will be able to join the active set and earn staking rewards.

Participants (delegators) would be rewarded proportionally to their deposited stake at the granularity of an epoch. Delegators will continue to have the same stake management controls (such as `add_stake`, `unlock`, `withdraw` etc.) in the delegation pool, similar to pool owners in the existing staking-contract implementation.

For the P0, existing stake pools cannot be converted into a delegation stake pool. A new delegation stake pool would have to be created. However, this could be a future development.

## Motivation

The current staking mechanism puts the community at a disadvantage, as it is less probable that a single individual has 1M APT tokens to start their own validator.

Given this functionality is enabled, the community can participate in staking activities and incentivize validators thus adding value to the ecosystem.

On the other hand, the entry stake requirement makes it difficult for some actors, possibly experienced in maintaining and securing blockchain validators, to join the network as node operators. With this new functionality, they can get support from the community to enter the active set.

In the current staking implementation, the activeness of a validator is influenced by a single entity's stake (stake-pool owner) which can leave the node unstaked at any time (actually on lockup period expiration). In the new implementation, this scenario is less likely to occur.

## Rationale

This feature has the potential to increase the number of validators in the ecosystem leading to further decentralization and a higher amount of tokens staked on the protocol.

## Specification

A detailed specification of the proposed solution can be found [here](https://docs.google.com/document/d/1wmE_TV3AsYP_lAtSYOZg9tqJZ9_BeRCvfrz7OHXv7zA/edit?usp=sharing).

To summarize, the following behavior would be supported:

- Admin of the delegation pool = node operator
- Initiates delegation pool
- Join validator set
- Leave validator set
- Set commission rate at the start of contract
  - Contract will pay commission out first, then rewards to principal
  - Commission rate cannot be changed
- Delegators = token owners
  1.  Add stake
  2.  Schedule stake for unlocking
  3.  Cancel unlocking of stake (moves stake to previous state)
  4.  Withdraw stake
- Reset-lockup = No one
- Delegated voter = Admin

## Reference Implementation

There is a reference autonomous (external to the Aptos framework) and tested implementation treating the stake module as a black box at https://github.com/bwarelabs/aptos-delegation-pool.
Additionally, an example delegation pool, linked to a running validator node and active on the Aptos testnet, can be examined on the [explorer](https://explorer.aptoslabs.com/account/0x61f9e2697d5eee926e990b537a8286a029c908c1ae117e76ddf7a849bf87fb59/resources).

The integration into the Aptos framework would preserve the rewards-distribution formula and the accounting of delegators' stakes, while deprecating resources already available within the framework and responsible for tracking epochs, rewards and pool's aggregated stakes.

The delegation pool would remain a proxy resource for the underlying stake pool, while the factory module could support the wrapping of existing stake pools into delegation ones in the future.

## Risks and Drawbacks

The staking API initially exposed would incur a higher gas cost (only for delegation pools) as additional resources have to be stored and maintained in order to keep track of individual delegators' stakes and cumulative rewards earned by pool's aggregated stakes.

Compared to a single-owner stake pool, rewards produced each epoch would not be automatically restaked for delegators as this would introduce a quadratic complexity when updating the validators set at the epoch's end. Nonetheless, delegators can manually restake their earned rewards, while failing to do so over an entire year would result in their compound APR dropping from 16.18% (automatically restaking each epoch of 1h duration) to 15% (current reward rate).

The operator fee, previously configurable by the owner, could be set either by a governance process at the level of the delegation pool or immutably at pool's creation by the node operator itself. For the latter, delegators have the option to participate in pools of their choice with regard to fee and node performance.

The role of delegated voter could be either extended per delegator stake, assigned to the node operator itself for the entire stake or discarded for all delegated stake.

## Future Potential

Automatic restake could be achieved for a fixed maximum count of delegators owning the highest stakes within the delegation pool.

We could uniformly enforce that a delegator cannot decrease the total stake on the pool below the active threshold or decide to fully unstake the delegation pool through governance.

We could restrict the node operator to deposit a minimum stake amount in order to allow its pool to accept delegations.

## Suggested implementation timeline

We hope to get it on the mainnet in Q1, but this is pending further technical scoping.
