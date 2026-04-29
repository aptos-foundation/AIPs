---
aip: 141
title: 10x Gas Fee Increase
author: Calin Tataru (calin.tataru@aptoslabs.com)
Status: Accepted
last-call-end-date: N/A
type: Standard (Core)
created: 04/03/2026
updated: 04/03/2026
requires: N/A
---

# AIP-141: 10x Gas Fee Increase

## Summary

This AIP proposes a 10x increase to all Aptos gas costs and storage fees through an on-chain gas schedule update approved via governance. The change raises the cost of computation, I/O, and state storage uniformly by a factor of 10, bringing Aptos gas fees closer to sustainable economic levels while remaining among the lowest absolute transaction costs of any major L1. This is one of seven tokenomics reforms announced by the Aptos Foundation to transition from a high-inflation bootstrap model to a mature, deflationary financial network.

## Motivation

The Aptos Foundation is transitioning from bootstrap-era subsidies to performance-driven tokenomics that align token supply with network utilisation. The existing gas schedule was set during the early bootstrap phase to minimize friction for users and developers, but that model does not work for a mature financial network.

Gas fees are paid in APT and mostly burned, directly reducing supply with every transaction. At current fee levels, the burn contribution is negligible. With a proposed hard supply cap of 2.1B APT and a planned deflationary model via Decibel burns and other methods, gas fees must carry meaningful economic weight to create conditions for net deflationary supply.

Even after the 10x increase, Aptos remains one of the lowest cost blockchains, with transaction fees orders of magnitude below other blockchains.

## Out of Scope

- Changes to the gas schedule beyond the uniform 10x multiplier (e.g., restructuring relative costs between operation types).
- The staking reward reduction, Decibel burn mechanism, hard supply cap, or Foundation lock-up commitments; those are addressed in separate governance proposals.
- Changes to network throughput or transaction size limits; only the gas schedule is affected.

## High-Level Overview

All gas parameters in the Aptos gas schedule are multiplied by 10. This covers:

- **Intrinsic transaction costs** (`txn.min_transaction_gas_units`, `txn.intrinsic_gas_per_byte`)
- **Instruction execution costs** (all VM opcodes, native function calls)
- **Move stdlib and Aptos framework native costs**
- **Table extension costs**
- **Storage I/O costs** (state reads, state writes, event byte writes, transaction byte writes)
- **Storage fees** (per-slot creation fees, per-byte storage fees)

The multiplier is applied uniformly so the *relative* cost of different operations is preserved. No operation becomes disproportionately more expensive than another.

Gas limits that are denominated in internal gas units are also scaled 10x (`txn.max_execution_gas`, `txn.max_io_gas`, `txn.max_storage_fee`). This is required so that the effective computational budget per transaction (measured in real work) stays the same. Without this, transactions would hit their ceilings sooner and the maximum allowed computation per transaction would effectively be cut by 90%.

Structural limits that are not denominated in gas units are left unchanged. This includes `txn.memory_quota`, `txn.max_num_dependencies`, `txn.max_ty_size`, and `txn.large_transaction_cutoff`. These govern counts and sizes, not costs, and are unaffected by the gas schedule change.

## Impact

| Audience | Impact | Required Action |
| --- | --- | --- |
| End users | Transaction fees increase ~10x in APT terms. Absolute cost remains orders of magnitude below other blockchains. | None; wallets and dApps display fees automatically. |
| dApp developers | Applications that rely on gas cost estimates (e.g., fee payers, sponsored transactions) must update their fee budgets. | Update hardcoded `max_gas_amount` values; retest fee sponsorship flows. |
| Indexers / SDKs | Gas cost constants in off-chain tooling may need updating if they are hardcoded. | Audit for hardcoded gas cost assumptions. |
| Wallet providers | Wallet gas estimators and fee heuristics may require updates if they rely on historical gas usage assumptions. | Verify transaction simulation logic and update safety multipliers if necessary. |
| Validators / node operators | Revenue from gas fees increases proportionally; no infrastructure changes required. | None. |
| Protocols with state-heavy operations | Creating new state slots and writing large values becomes relatively more expensive, incentivizing efficient storage use. | Review on-chain data storage patterns; consider using ephemeral or compressible representations. |

## Specification and Implementation Details

The change is implemented as a new on-chain gas schedule submitted through the standard Aptos governance path. No protocol changes or Move framework upgrades are required; gas schedules are stored on-chain and updated atomically.

### Changed Parameters

The following tables show a representative subset of the changed parameters. All parameters across all categories are scaled by the same 10x factor. Gas cost parameters are expressed in internal gas units; storage fee parameters are expressed in octas.

**Transaction & Storage**

| Parameter | Old Value | New Value |
| --- | --- | --- |
| `txn.min_transaction_gas_units` | 2,760,000 | 27,600,000 |
| `txn.intrinsic_gas_per_byte` | 1,158 | 11,580 |
| `txn.storage_io_per_state_slot_read` | 302,385 | 3,023,850 |
| `txn.storage_io_per_state_byte_read` | 151 | 1,510 |
| `txn.storage_io_per_state_slot_write` | 89,568 | 895,680 |
| `txn.storage_io_per_state_byte_write` | 89 | 890 |
| `txn.storage_fee_per_state_slot` | 40,000 | 400,000 |
| `txn.storage_fee_per_state_byte` | 40 | 400 |
| `txn.max_execution_gas` | 920,000,000 | 9,200,000,000 |
| `txn.max_io_gas` | 1,000,000,000 | 10,000,000,000 |
| `txn.max_storage_fee` | 200,000,000 | 2,000,000,000 |

**VM Instructions**

| Parameter | Old Value | New Value |
| --- | --- | --- |
| `instr.nop` | 36 | 360 |
| `instr.ret` | 220 | 2,200 |
| `instr.br_true` | 441 | 4,410 |
| `instr.ld_u64` | 220 | 2,200 |
| `instr.call.base` | 3,676 | 36,760 |
| `instr.call.per_arg` | 367 | 3,670 |

**Native Functions**

| Parameter | Old Value | New Value |
| --- | --- | --- |
| `move_stdlib.bcs.to_bytes.per_byte_serialized` | 36 | 360 |
| `move_stdlib.hash.sha2_256.base` | 11,028 | 110,280 |
| `move_stdlib.hash.sha2_256.per_byte` | 183 | 1,830 |
| `aptos_framework.account.create_address.base` | 1,102 | 11,020 |
| `aptos_framework.account.create_signer.base` | 1,102 | 11,020 |
| `table.add_box.base` | 4,411 | 44,110 |
| `table.borrow_box.base` | 4,411 | 44,110 |

### Reference Implementation

- [aptos-core#18880](https://github.com/aptos-labs/aptos-core/pull/18880): applies the 10x multiplier across all gas schedule files.
- [aptos-core#18920](https://github.com/aptos-labs/aptos-core/pull/18920): helper script used to mechanically apply the multiplier.

Key files modified:

- `aptos-move/aptos-gas-schedule/src/gas_schedule/aptos_framework.rs`
- `aptos-move/aptos-gas-schedule/src/gas_schedule/instr.rs`
- `aptos-move/aptos-gas-schedule/src/gas_schedule/move_stdlib.rs`
- `aptos-move/aptos-gas-schedule/src/gas_schedule/table.rs`
- `aptos-move/aptos-gas-schedule/src/gas_schedule/transaction.rs`

## Testing

- All existing gas-sensitive end-to-end tests have been updated to reflect the new gas schedule.
- Transaction simulation tests updated in `aptos-transaction-simulation`.

## Risks and Drawbacks

**User experience friction.** Users on Aptos blockchain may notice fees are 10x higher in APT terms. In practice, the USD impact at current APT prices remains small for everyday operations, but high-frequency applications making many transactions per second may see a meaningful cost increase.

**Application breakage.** dApps or scripts with hardcoded `max_gas_amount` values may fail if those values are below the new minimum transaction gas. Developers must audit and update their integrations ahead of mainnet activation.

**State-heavy protocols.** Protocols that issue large numbers of new state slots will see a proportionally larger increase in absolute fees. This is an intentional outcome; it corrects the previous subsidy, but may require protocol-level optimizations.

**No backward compatibility breakage at the protocol level.** Gas schedules are on-chain parameters; updating them is a standard governance operation with no hard fork.

## Security Considerations

Higher gas costs reduce the attack surface for resource exhaustion via cheap spam transactions.
The minimum transaction cost floor (`txn.min_transaction_gas_units`) is increased 10x, making it substantially more expensive to flood the mempool with low-value transactions.

No cryptographic, consensus, or execution security properties are affected by this change.