---
aip: 146
title: Staking-Based Transaction Limits
author: George Mitenkov (george@aptoslabs.com)
discussions-to: https://github.com/aptos-foundation/AIPs/issues/669
Status: Draft
last-call-end-date (*optional):
type: Standard (Core, Framework)
created: 04/14/2026
updated (*optional): 04/15/2026
requires (*optional):
---

# AIP-146 - Staking-Based Transaction Limits

## Summary

Today, all Aptos transactions share the same execution gas limits.
However, some workloads such as complex DEX operations (liquidations), large state migrations, and emergency updates need more compute than the standard limit allows.
Right now, there is no mechanism to request higher limits.

This AIP introduces an opt-in mechanism for higher limits, backed by staking proof.
Users who prove they control significant stake can request higher multipliers (above 1x and up to 100x) on gas schedule limits (which otherwise default to 1x).

The rationale is straightforward: large APT stakers are inherently aligned with the network's long-term health.
Transaction and gas limits exist to protect the system from spam and maintain high performance, but large stakers are far more likely to have legitimate needs for higher limits than malicious intent.
Tying elevated limits to staking proof strikes a practical balance — it enables more complex on-chain use cases while preserving network performance and resilience.

In the initial implementation, only execution and IO limits can be increased.
For the staking proof, the following options are supported: **stake pool ownership**, **delegated voter status**, and **delegation pool delegation**.
Eligibility is determined by matching the sender's committed stake against a governance-configurable vector of tiers.
All staking-backed requests also require a **10x minimum gas unit price**.

### Out of scope

- SDK and CLI support for constructing high-limit transactions are not included in this change and are tracked separately.
- High-limit transactions are not treated differently by mempool.

## High-level Overview

A new `transaction_limits.move` module stores a governance-configurable vector of tiers for different limits.
Each tier pairs a minimum committed stake with a multiplier (in basis points, where 1x = 100 basis points).
When a transaction carries a `UserTxnLimitsRequest`, the prologue validates that the sender is authorized to use the specified stake, and that the committed stake meets the threshold for the requested multipliers.
The smallest tier whose multiplier is greater than or equal to the requested multiplier is chosen, so requests for non-standard values (e.g. 3.23x) need the same stake amount as the next available tier.
The gas meter applies the requested multipliers to the base limit.

## Impact

This feature enables validators, large stakers, and delegation pool delegators to submit transactions that require more compute than the standard limits allow.
It also provides a path for emergency operations that previously required waiting for governance proposals.
Wallet and SDK developers will need to support constructing `TransactionExtraConfig::V2` payloads with the new `txn_limits_request` field.

## Alternative Solutions

**Flat fee with per-epoch slot cap.**
An alternative design would charge a flat premium (e.g., 100 APT) and cap the number of high-limit transactions per epoch via a counter.
However, a flat fee does not scale with the degree of privilege requested, and a per-epoch cap introduces contention for limited slots.

**Gas price multiplier only.**
Requiring a higher gas price alone (without staking proof) would increase cost but not tie it to a verifiable economic stake.
Any sufficiently funded account could access elevated limits, weakening the Sybil resistance.

## Specification and Implementation Details

### TransactionExtraConfig::V2

The V2 payload configuration carries an optional `UserTxnLimitsRequest`:

```rust
pub enum TransactionExtraConfig {
    V1 { .. },
    V2 {
        .. 
        /// If set, the transaction requests increased gas limits backed by
        /// staking proof.
        txn_limits_request: Option<UserTxnLimitsRequest>,
    },
}
```

### RequestedMultipliers, UserTxnLimitsRequest, and TxnLimitsRequest

Multipliers are expressed in basis points (100 = 1x, 200 = 2x, 250 = 2.5x).
They are wrapped in a versioned enum so that new dimensions can be added in the future.

```rust
pub enum RequestedMultipliers {
    V1 { execution_bps: u64, io_bps: u64 },
}
```

The user-facing request is BCS-serialized in the transaction payload:

```rust
pub enum UserTxnLimitsRequest {
    /// Sender holds the OwnerCapability for a stake pool. The pool address
    /// is derived from the capability on-chain.
    StakePoolOwner { multipliers: RequestedMultipliers },
    /// Sender is the delegated voter of the specified stake pool.
    DelegatedVoter { pool_address: AccountAddress, multipliers: RequestedMultipliers },
    /// Sender is a delegator in the specified delegation pool.
    DelegationPoolDelegator { pool_address: AccountAddress, multipliers: RequestedMultipliers },
}
```

The VM wraps this into an internal `TxnLimitsRequest` enum that also covers governance:

```rust
pub enum TxnLimitsRequest {
    ApprovedGovernanceScript,
    Staking(UserTxnLimitsRequest),
}
```

`TransactionMetadata` is populated with a `TxnLimitsRequest`:

- If the transaction is an approved governance script (matched against `ApprovedExecutionHashes`), the request is `ApprovedGovernanceScript`.
- Otherwise, if the feature is enabled and the payload includes a `UserTxnLimitsRequest`, the request is `Staking(...)`.
- Otherwise, `None` (standard limits) or an error is returned (feature disabled and high limit requested).

### On-chain module: `transaction_limits.move`

The module stores a vector of tiers for each dimension.
Each tier pairs a minimum committed stake with a multiplier in basis points:

```move
struct TxnLimitTier has copy, drop, store {
    min_stake: u64,
    multiplier_bps: u64,
}

enum TxnLimitsConfig has key {
    V1 {
        execution_tiers: vector<TxnLimitTier>,
        io_tiers: vector<TxnLimitTier>,
    }
}
```

Tiers must be monotonically ordered: minimum stakes are non-decreasing and multipliers are strictly increasing.
This is enforced on initialization and update.
Corresponding `RequestedMultipliers` and `UserTxnLimitsRequest` enums are defined in Move with the same BCS layout as the Rust types.

#### Initialization

Initialization is only used for genesis (devnet).

```move
friend fun initialize(
    aptos_framework: &signer,
    execution_tiers: vector<TxnLimitTier>,
    io_tiers: vector<TxnLimitTier>,
)
```

Genesis uses the following default tiers:

| Tier | Multiplier   | Execution min stake | IO min stake |
|------|--------------|---------------------|--------------|
| 1    | 2x (200 bps) | 1M APT              | 5M APT       |
| 2    | 4x (400 bps) | 10M APT             | 20M APT      |
| 3    | 8x (800 bps) | 50M APT             | 100M APT     |

IO thresholds are higher than execution thresholds because IO operations are more expensive for the network.

#### Governance updates

```move
public entry fun update_config(
    aptos_framework: &signer,
    execution_min_stakes: vector<u64>,
    execution_multipliers_bps: vector<u64>,
    io_min_stakes: vector<u64>,
    io_multipliers_bps: vector<u64>,
) acquires TxnLimitsConfig
```

Governance can add, remove, or modify tiers without code changes.

#### Tier matching

When validating a request, the module finds the smallest tier whose multiplier is greater than or equal to the requested multiplier and returns its `min_stake`.
For example, if tiers are `[2x: 1M, 4x: 10M, 8x: 50M]` and the user requests 3x, the 4x tier is selected with a 10M APT threshold.
If no tier can cover the request, the transaction is rejected.

#### Prologue validation

Move prologue validates submitted requests.

```move
friend fun validate_high_txn_limits(
    sender: address,
    request: UserTxnLimitsRequest,
) acquires TxnLimitsConfig
```

This function:
1. Validates authorization based on the request variant:
   - `StakePoolOwner`: checks that the sender holds an `OwnerCapability` and derives the pool address from it.
   - `DelegatedVoter`: checks that the stake pool exists and the sender is its delegated voter.
   - `DelegationPoolDelegator`: checks that the delegation pool exists and reads the sender's committed stake (`active + pending_inactive`).
2. Validates that both multipliers are greater than 100 bps (1x) and at most 10000 (100x).
3. Finds the matching tier for each dimension (execution and IO).
4. Checks that the committed stake meets both thresholds.

### Transaction validation: v3 prologue

New v3 versions of the unified prologue functions extend v2 with an additional `txn_limits_request: Option<UserTxnLimitsRequest>` parameter (`unified_prologue_v3`, `unified_prologue_fee_payer_v3`).

### Rust-side validation (Aptos VM)

Before the Move prologue runs, Rust validates:

1. If the payload contains a `txn_limits_request` but the feature is not enabled, the transaction is discarded with `FEATURE_UNDER_GATING`.

2. Multipliers are greater than 100 and at most 10000.
   This ensures that the gas meter is always created with bounded limits, preventing overflow issues prior to Move prologue validation.

3. Staking-backed requests require `gas_unit_price >= 10 * min_price_per_gas_unit`.
   Failing this check produces `GAS_UNIT_PRICE_BELOW_MIN_BOUND`.

4. The `ApprovedGovernanceScript` variant is never deserialized from user input.
   It is only set by the VM when the transaction's script hash matches an entry in `ApprovedExecutionHashes`.
   A user cannot forge a governance request.

Stake requirements are validated by the Move prologue in `transaction_limits::validate_high_txn_limits`.

### Gas metering

The gas meter receives `Option<&TxnLimitsRequest>` and configures limits accordingly:

| Request                     | Execution limit                           | IO limit                    | Storage limit         |
|-----------------------------|-------------------------------------------|-----------------------------|-----------------------|
| `None`                      | `max_execution_gas`                       | `max_io_gas`                | `max_storage_fee`     |
| `ApprovedGovernanceScript`* | `max_execution_gas_gov`                   | `max_io_gas_gov`            | `max_storage_fee_gov` |
| `Staking(req)`              | `max_execution_gas * execution_bps / 100` | `max_io_gas * io_bps / 100` | `max_storage_fee`     |

(*) For governance proposals, higher limits are only used since v1.13 release.

### Error codes

New `StatusCode`s were added for prologue failures.

| StatusCode                           | Code | Meaning                                                       |
|--------------------------------------|------|---------------------------------------------------------------|
| `NOT_STAKE_POOL_OWNER`               | 46   | Sender does not hold an `OwnerCapability`                     |
| `NOT_DELEGATED_VOTER`                | 47   | Sender is not the delegated voter of the specified stake pool |
| `INSUFFICIENT_STAKE`                 | 48   | Committed stake is too low for the requested multiplier tier  |
| `INVALID_HIGH_TXN_LIMITS_MULTIPLIER` | 49   | Multiplier is <= 100 bps (i.e. <= 1x)                         |
| `STAKE_POOL_NOT_FOUND`               | 50   | No stake pool exists at the specified address                 |
| `DELEGATION_POOL_NOT_FOUND`          | 51   | No delegation pool exists at the specified address            |
| `MULTIPLIER_NOT_AVAILABLE`           | 52   | Requested multiplier exceeds all configured tiers             |

Aborts from the `transaction_limits` module are routed through a dedicated error conversion path, to map to these status codes.

## Reference Implementation

PR: https://github.com/aptos-labs/aptos-core/pull/19109, gated under `TRANSACTION_LIMITS` feature flag.

## Testing

The `transaction_limits.move` module includes unit tests covering tier construction and validation logic.

- Tier creation rejects wrong multipliers.
- Tier vectors must be monotonically ordered (non-decreasing stakes, strictly increasing multipliers).
- Tier matching rounds up to the smallest tier >= the requested multiplier.
- Requesting a multiplier beyond all configured tiers is rejected.
- Stake validation checks execution and IO thresholds independently.
- Validation aborts on unsatisfied requests.

End-to-end Move tests (`e2e-move-tests/src/tests/transaction_limits.rs`) cover similar scenarios and additionally test error propagation.

## Risks and Drawbacks

- Large stakers (exchanges, custodians) naturally have more committed stake and therefore qualify for higher tiers.
  This is by design since it ties the privilege to economic stake, but it means smaller participants cannot access higher multipliers.
- A stake pool owner can set any address as delegated voter, effectively granting elevated limits to that address.
  If a pool owner's key is compromised, the attacker can delegate voter rights to their own address.
  This risk is inherent to the delegation model and is not new — a compromised owner key already enables other harmful actions such as changing the operator or withdrawing stake.
- High IO multipliers let a single transaction perform significantly more state reads/writes.
  This is mitigated by the high stake requirements for upper tiers, 10x gas price floor, and internal VM limits on write-set size.

## Security Considerations

1. Authorization is validated on-chain by the Move prologue against live staking state.
   Ownership, delegation, and delegator relationships cannot be forged without controlling the relevant keys.

2. The `ApprovedGovernanceScript` variant is set only by the VM when the script hash matches `ApprovedExecutionHashes`.
   It is never deserialized from user-submitted BCS. A user payload containing governance-like data would only ever be interpreted as a `Staking(...)` variant.

3. The 10x minimum gas price makes high-limit transactions at least 10x more expensive per gas unit, discouraging frivolous use.

4. Multipliers must be more than 1x and at most 100x, and must match a configured tier.
   This is enforced in the Move prologue.
   Basis-point arithmetic uses `saturating_mul` in the gas meter as a safeguard, though the enforced bounds on multipliers (1x-100x) already make overflow impossible.

5. A user's eligibility can change between epochs as stake is added or removed.
   The prologue reads current on-chain staking state, so eligibility is always up to date.

6. There is no per-epoch cap on high-limit transactions.
   This is a deliberate choice: the staking requirement and 10x gas price floor already provide economic rate-limiting, and an artificial cap would create slot contention among legitimate users.

7. Tiers are always well-ordered and validated at construction time.
   Governance cannot accidentally create a config where a lower stake unlocks a higher multiplier.

## Future Potential

- The `RequestedMultipliers` enum can be extended to cover new dimensions (e.g. transaction size, storage) via a V2 variant.
- Wallet and CLI tooling can expose high-limit transaction construction as a first-class feature for stakers.
- Rate limiting can be added to cap the number of high-limit transactions per block or per epoch.

## Timeline

TBD.
