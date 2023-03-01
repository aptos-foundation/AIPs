---
aip: 17
title: Storage Fee
author: msmouse, vgao1996, davidiw
discussions-to: https://github.com/aptos-foundation/AIPs/issues/79
Status: Draft
last-call-end-date: TBD
type: Standard
created: 02/28/2023
updated:
requires:
---

# AIP-17 - Storage Fee
  
## Summary

This AIP proposes to decouple storage space related gas charges from execution and I/O gas charges. Execution and I/O charges will continue to be determined by the gas unit price, hence the Aptos "fee market". Storage space related gas charges will be based on absolute values in the native token. This decoupling enables substantial reduction in transaction costs especially for transactions with heavy execution and I/O heavy dependencies.

## Motivation

In Blockchain architecture, there are two fundamental types of resources, categorized by the nature of their scarcity:

1. **Transient**: CPU, IOPS and bandwidth - effectively replenished every instant that the system remains online. The price of effectively unlimited resources can be driven by demand, making an underutilized system cheap or even free. Because these resources are bought or rented and a sunk cost, not using them is nearly pure waste, with the caveat that there is some amount of cost associated with power and possibly network traffic.
2. **Permanent**: State items once allocated, cost disk space and impose performance penalty on the entire fleet forever, unless deleted. It makes sense to charge state items whenever they exist in the DB, and according to the time span they exist in the DB. Similarly, transactions themselves and emitted events occupy disk space for non-negligible period of time, although not permanently because the nodes do prune the ledger, should be charged accordingly.

Each transaction must have a maximum amount of gas to limit both the time it can execute and how much storage it can consume. As a result, execution, IO, and space consumption must be defined relative to each other. As a result, execution fees tend to be above market rate, whereas storage fees do not reflect their scarcity and make support for concepts like refunds challenging.

The proposal here is to charge storage space consumption in terms of the native token instead of gas units, so it's independent of user specified gas unit price. To simplify implementation, the user interface does not change, so the effective cost will be deducted from the maximum transaction fee specified with a user transaction.

### Alternative - Maximum Storage Space in a Transaction

A more systematic approach would be to introduce a new field on the transaction to specify maximum storage fees. While this provides a more systematic and explicit means to indicate intended outcomes, it creates a burden on the ecosystem to adopt a new transaction standard. Current expectations are that such additional friction provides limited value; however, over time, Aptos will aggregate more useful features to expose and will adopt this along with other useful updates to the transaction interface.

## Specification

### Language and framework

No visible change to how one writes Move, no visible change to how one uses the SDK and CLI. But the economics changes:

### Economics

The dimensions of [storage gas charges](https://github.com/aptos-labs/aptos-core/blob/7ad1c053f8a33aba4a485fe28e81a6f419187eaf/aptos-move/framework/aptos-framework/sources/storage_gas.move#L183-L196) will remain because these operations do impose runtime transient resource consumption. :

- `per_item_create` and `per_item_write` will be adjusted.
- `per_byte_create` and `per_byte_write`remains the same.

As a follow-up, the distinction between `create` and `write` variations of the storage gas parameters can be removed. On top of that, all storage gas charges can potentially scale lower, as they no longer bear the responsibility of defending against state explosion.

In addition, storage space related gas parameters will be defined in the unit of the native token. At runtime, the cost is calculated in the native token and converted to gas units according to the user specified gas unit price: `charge_in_gas_unit = charge_in_octas / gas_unit_price`

### configuration

These entries will be added to the global gas schedule to specify the native token costs for various storage space consuming operations:

- `storage_fee_per_state_slot_create`
- `storage_fee_per_excess_state_byte`
- `storage_fee_per_event_byte`
- `storage_fee_per_transaction_byte`

These per transaction hard limits for different categories of gas charges will be added to the global gas schedule to reflect that the network has different amounts of resources under different categories, a reasonable amount of gas spent on disk space allocation in a single transaction might be sufficient for another transaction to run for minutes of CPU consuming operations.

- `max_execution_gas`: This is in gas units.
- `max_io_gas_per`: This is in gas units, governing the transient aspects of the storage cost, i.e. IOPS and bandwidth.
- `max_storage_fee`: This is in Octas, governing the new category of fees described in this proposal.

## Reference Implementation

[#6683](https://github.com/aptos-labs/aptos-core/pull/6683)

[#6816](https://github.com/aptos-labs/aptos-core/pull/6816)

## Risks and Drawbacks

Combining the storage fee as part of the gas charge is unintuitive. Better tooling will be required to  gain visibility into the cost structure of transactions. Furthermore, the documentation site needs to be updated with these changes.

## Future Potential

### Deletion Refund 

To incentivize "state hygiene", or state space cleanup, further effort will enable refunding part or full of the storage fee paid for allocating a storage slot. The fact that the allocation will be charged in the native token instead of gas units as a result of this proposal largely eliminates the concerns around storage refund arbitrage.

## Suggested deployment timeline

Testnet and Mainnet in March.
