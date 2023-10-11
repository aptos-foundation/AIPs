---
aip: 50
title: Change commission rates in delegation pools
author: junkil-park, michelle-aptos, movekevin, wintertoro
discussions-to: https://github.com/aptos-foundation/AIPs/issues/249
Status: In Review
type: Standard Framework
created: 09/28/2023
---

# AIP-50 - Change commission rates in delegation pools

## Summary
Currently, the commission rate is set by the pool owner at the initiation of the pool and fixed afterward. We propose allowing the pool owner to change the commission rate after delegation pool creation.

There is a risk that the pool owner can change the commission rate without the staker knowing. To mitigate this, the maximum commission rate change per lockup period is capped and must be executed at least 7 days before the lockup cycle ends. The change does not take effect until the next lockup period, so the staker can unstake before the change takes effect. Wallets and staking UIs should listen to update commission events to build notifications to alert stakers.

### Goals
This feature will increase the flexibility of pool owners over network/commission rates. Pool owners can adjust operator commission rates as appropriate, based on market conditions and commercial discussions. As such, this will facilitate staking pools to participate in market dynamics. I.e. the pool can be set at a lower commission to attract more stakers, or raise commission when needed. Operators can call the function themselves if they are also the pool owner, or if not, work with the pool owner they are operating for.

### Out of Scope
Operators will not be able to change the commission rate. In our existing design setup, operators are designated by pool owners.

### Impact
* *Delegation pool owners* have permission to change the operator commission rate.
* *Operators* are impacted by commission rate changes, which will impact their rewards.
* *Delegators* need to watch over commission rate changes so that they are not overcharged. They may assume that the commission rate is fixed.

## Alternative solutions
There is no alternative solution because the delegation pool module currently does not allow changing the operator commission rate.

Moreover, allowing operators to change the commission rate would not make sense in the context of our existing design setup. Right now, operators are designated by pool owners, so eventually, pool owners control everything.

## Specification
* The signature of the function to change the commission rate is as follows:
    ```rust
    public entry fun update_commission_percentage(
        owner: &signer,
        new_commission_percentage: u64
    )
    ```
* Only the pool owner can change the operator commission rate.
* The maximum commission rate is 100%. The minimum commission rate is 0%.
* The maximum absolute increase rate per lockup cycle is 10%, which is relative to the current commission rate. For example, if the current commission rate is 9%, the new commission rate cannot be higher than 19% in the next lockup cycle. This is to safeguard delegators from sudden changes in commission rate.
* There is no maximum decrease rate.
* The minimum remaining lockup time is 7 days. In other words, the commission rate change can be requested only if 7 or more days are left in the current lockup period.
* The new commission rate will not take effect until the next lockup cycle. Multiple calls to change commission rate can be made, but only the last call before the end of the lockup cycle will take effect.
* An event is emitted when the commission rate is changed.
* The upcoming commission rate change is clearly displayed on the staking front-end UI in the Aptos Explorer and Petra Mobile.

## Reference Implementation
Please refer to https://github.com/aptos-labs/aptos-core/pull/10226.

## Testing
- What is the testing plan?
Automated unit tests and testing in devnet/testnet before releasing to mainnet.

## Risks and Drawbacks
A delegation pool owner can be the operator of the pool too. The pool owner can change the operator commission rate to a higher value and take a larger share of the rewards generated. To mitigate this,
1. We limit the maximum commission increase to 10% per lockup cycle.
2. We limit the minimum remaining lockup time to 7 days.
3. We emit an event when the function to update the commission rate is called. This can be tied into front-end alerts.

## Timeline

### Suggested deployment timeline

This change will be part of the v1.8 release.

### Security Considerations

The framework change in delegation_pool.move will be audited before it is considered complete.
