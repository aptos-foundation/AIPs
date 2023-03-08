---
aip: 19
title: Enable updating commission_percentage
author: michelle-aptos, gerben-stavenga
discussions-to (*optional): <a url pointing to the official discussion thread>
Status: Draft
last-call-end-date (*optional): 
type: Standard
created: 3/8/2023
updated (*optional): 3/8/2023

---

# AIP-19 - Enable updating commission_percentage in staking_contract module
 
## Summary

This AIP proposes an update to `staking_contract.move`, which would allow the stake pool owner to change `commission_percentage`.

## Motivation

Currently, `commission_percentage` cannot be changed. The updating commission percentage feature will allow for better adaptability to changing market conditions.

## Rationale

**Considerations:**

1. The staking contract tracks how much commission needs to be paid out to the operator. Updating `commission_percentage` is a convenience function added to `staking_contract.move` to allow a stake pool owner to update the commission percentage paid to the operator.
2. `Commission_percentage` can be updated by the stake pool owner at any time. Commission is earned on a per epoch basis. The change takes into effect immediately for all future commissions earned when the update function is called, but will not be retroactively applied to any previously earned commissions. 
3. UpdateCommissionEvent gets emitted when the `update_comission` function is called

**Alternative solutions:**

The staking contract would have to be ended and a new one has to be created in order to change the `commission_percentage`. This is a less ideal solution as it creates more operational overhead and would result in missed staking rewards. 

## Reference Implementation

[https://github.com/aptos-labs/aptos-core/blob/main/aptos-move/framework/aptos-framework/sources/staking_contract.move](https://github.com/aptos-labs/aptos-core/blob/main/aptos-move/framework/aptos-framework/sources/staking_contract.move)

[https://github.com/aptos-labs/aptos-core/pull/6623/](https://github.com/aptos-labs/aptos-core/pull/6623/files)

## Risks and Drawbacks

Changing `commission_percentage` may introduce uncertainty into commission earnings because it is possible that operators are paid at different commission rates during an unlock cycle. However, there is no additional action required for the operator as changes take into effect immediately.

We can mitigate this in a future iteration by implementing a max commission change per period. This is not a concern with the current owner-operator structure.

## Future Potential

This feature will give the stake pool `owner` more flexibility over the `commission_percentage` to reflect changing market conditions. 

## Suggested implementation timeline

Targeting end of Q1

## Suggested deployment timeline

This feature is currently on devnet and testnet as part of v1.3.
