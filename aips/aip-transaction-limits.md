---
aip:
title: Staking-Based Transaction Limits
author: George Mitenkov (george@aptoslabs.com)
discussions-to (*optional):
Status: Draft
last-call-end-date (*optional):
type: Standard (Core, Framework)
created: 04/14/2026
updated (*optional): 04/15/2026
requires (*optional):
---

# AIP-X - Staking-Based Transaction Limits

## Summary

Today, all Aptos transactions share the same execution gas limits. However, some workloads such as complex DeFi operations (liquidations), large state migrations, and emergency updates need more compute than the standard limit allows. Right now, there is no mechanism to request it.

This feature introduces an opt-in mechanism for higher execution and IO gas limits, backed by staking proof. Users who prove they control significant stake can request arbitrary multipliers (expressed in basis points, e.g. 250 = 2.5x) on execution and IO gas limits independently. Three forms of staking proof are supported: **stake pool ownership**, **delegated voter status**, and **delegation pool delegation**. Eligibility is determined by matching the user's committed stake against a governance-configurable vector of tiers. A **10x minimum gas unit price** is required for all staking-backed requests.

Governance proposal scripts are also unified into the same system: approved governance scripts automatically receive elevated limits without requiring any staking proof.

### Out of scope

- SDK and CLI support for constructing high-limit transactions are not included in this change and are tracked separately.
- High-limit transactions are not treated differently by mempool.

## High-level Overview

A new `transaction_limits.move` module stores a configurable vector of tiers for execution and IO independently. Each tier pairs a minimum committed stake with a multiplier (in basis points). When a transaction carries a `UserTxnLimitsRequest`, the prologue validates that the sender is authorized to use the specified stake, and that the committed stake meets the threshold for the requested multipliers. The smallest tier whose multiplier is >= the requested multiplier is chosen, so requests for non-standard values (e.g. 3x) are rounded up to the next available tier. Multiplier validity (must be > 1x, i.e. > 100 bps) and the 10x gas price floor are enforced as part of validation.

The gas meter applies the requested multipliers to the base `max_execution_gas` and `max_io_gas` values using basis-point arithmetic (`base * bps / 100`). Storage limits are not affected.

Governance proposal scripts are handled through the same `TxnLimitsRequest` enum (as an `ApprovedGovernanceScript` variant), providing a unified code path for all elevated-limit transactions.

## Impact

This feature enables validators, large stakers, and delegation pool delegators to submit transactions that require more compute than the standard limits allow. It also provides a path for emergency operations that previously required waiting for governance proposals.

Wallet and SDK developers will need to support constructing `TransactionExtraConfig::V2` payloads with the new `txn_limits_request` field.

## Alternative Solutions

**Flat fee with per-epoch slot cap.** A simpler design would charge a flat premium (e.g., 100 APT) and cap the number of high-limit transactions per epoch via a counter. However, a fixed fee is disconnected from actual stake-in-the-game, all slots could be consumed by a single actor, and a per-epoch cap is a blunt instrument. Tying eligibility to committed stake provides a natural, stake-proportional access control without artificial caps.

**Gas price multiplier only.** Requiring a higher gas price alone (without staking proof) would increase cost but not tie it to a verifiable economic stake. Any sufficiently funded account could access elevated limits, weakening the Sybil resistance argument.

**Fixed multiplier tiers (2x/4x/8x only).** Restricting to a small set of hardcoded multipliers is simpler but less flexible. Basis-point multipliers allow fractional values (e.g. 2.5x, 1.5x) and let governance add new tiers without code changes.

## Specification and Implementation Details

### TransactionExtraConfig::V2

The V2 payload configuration carries an optional `UserTxnLimitsRequest`:

```rust
pub enum TransactionExtraConfig {
    V1 {
        multisig_address: Option<AccountAddress>,
        replay_protection_nonce: Option<u64>,
    },
    V2 {
        multisig_address: Option<AccountAddress>,
        replay_protection_nonce: Option<u64>,
        /// If set, the transaction requests increased gas limits backed by
        /// staking proof.
        txn_limits_request: Option<UserTxnLimitsRequest>,
    },
}
```

### RequestedMultipliers, UserTxnLimitsRequest, and TxnLimitsRequest

Multipliers are expressed in basis points (100 = 1x, 200 = 2x, 250 = 2.5x) and wrapped in an extensible enum:

```rust
pub enum RequestedMultipliers {
    V1 { execution_bps: u64, io_bps: u64 },
}
```

The user-facing request, BCS-serialized in the transaction payload:

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
- Otherwise, if the `TRANSACTION_LIMITS` feature is enabled and the payload includes a `UserTxnLimitsRequest`, the request is `Staking(...)`.
- Otherwise, `None` (standard limits).

### On-chain module: `transaction_limits.move`

The module stores a vector of tiers for each dimension. Each tier pairs a minimum committed stake with a multiplier in basis points:

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

Tiers must be monotonically ordered: minimum stakes are non-decreasing and multipliers are strictly increasing. This is enforced on initialization and update.

Matching `RequestedMultipliers` and `UserTxnLimitsRequest` enums are defined in Move with the same BCS layout as the Rust types:

```move
enum RequestedMultipliers has copy, drop, store {
    V1 { execution_bps: u64, io_bps: u64 },
}

enum UserTxnLimitsRequest has copy, drop {
    StakePoolOwner { multipliers: RequestedMultipliers },
    DelegatedVoter { pool_address: address, multipliers: RequestedMultipliers },
    DelegationPoolDelegator { pool_address: address, multipliers: RequestedMultipliers },
}
```

**Initialization** (called at genesis):

```move
public(friend) fun initialize(
    aptos_framework: &signer,
    execution_tiers: vector<TxnLimitTier>,
    io_tiers: vector<TxnLimitTier>,
)
```

Genesis default tiers:

| Tier | Multiplier | Execution min stake | IO min stake |
|------|-----------|-------------------|------------|
| 1 | 2x (200 bps) | 1M APT | 5M APT |
| 2 | 4x (400 bps) | 10M APT | 20M APT |
| 3 | 8x (800 bps) | 50M APT | 100M APT |

IO thresholds are higher than execution thresholds because IO operations are more expensive for the network.

**Governance update:**

```move
public entry fun update_config(
    aptos_framework: &signer,
    execution_min_stakes: vector<u64>,
    execution_multipliers_bps: vector<u64>,
    io_min_stakes: vector<u64>,
    io_multipliers_bps: vector<u64>,
) acquires TxnLimitsConfig
```

Governance can add, remove, or modify tiers without code changes. For example, adding a 1.5x tier or raising the 8x threshold only requires a governance proposal calling `update_config`.

**Tier matching:**

When validating a request, the module finds the smallest tier whose multiplier is >= the requested multiplier and returns its `min_stake`. For example, if tiers are `[2x: 1M, 4x: 10M, 8x: 50M]` and the user requests 3x, the 4x tier is selected with a 10M APT threshold. If no tier can cover the request, the transaction is rejected.

**Prologue validation:**

```move
public(friend) fun validate_high_txn_limits(
    sender: address,
    request: UserTxnLimitsRequest,
) acquires TxnLimitsConfig
```

This function:
1. Validates authorization based on the request variant:
   - `StakePoolOwner`: checks that the sender holds an `OwnerCapability` and derives the pool address from it.
   - `DelegatedVoter`: checks that the stake pool exists and the sender is its delegated voter.
   - `DelegationPoolDelegator`: checks that the delegation pool exists and reads the sender's committed stake (active + pending_inactive).
2. Validates that both multipliers are > 100 bps (> 1x).
3. Finds the matching tier for each dimension (execution and IO).
4. Checks that the committed stake meets both thresholds.

### Transaction validation: v3 prologue

New v3 versions of the unified prologue functions extend v2 with an additional `txn_limits_request: Option<UserTxnLimitsRequest>` parameter.

**Prologue** (`unified_prologue_v3`, `unified_prologue_fee_payer_v3`):

- If `txn_limits_request` is `Some(request)`:
    - Call `transaction_limits::validate_high_txn_limits(sender_address, request)`, which aborts on failure.
- Proceed with all existing prologue checks (balance, sequence number, etc.).

**Epilogue:** No changes to the epilogue are needed. The v2 epilogue is reused as-is since there is no additional fee to collect.

### Rust-side validation (Aptos VM)

Before the Move prologue runs, Rust validates:

1. **Feature flag**: If the payload contains a `txn_limits_request` but `TRANSACTION_LIMITS` is not enabled, the transaction is discarded with `FEATURE_UNDER_GATING`.
2. **Gas unit price floor**: Staking-backed requests require `gas_unit_price >= 10 * min_price_per_gas_unit`. Failing this check produces `GAS_UNIT_PRICE_BELOW_MIN_BOUND`.
3. **Governance injection**: The `ApprovedGovernanceScript` variant is never deserialized from user input. It is only set by the VM when the transaction's script hash matches an entry in `ApprovedExecutionHashes`. A user cannot forge a governance request.

All other validation (multiplier > 100 bps, multiplier exists in config, stake authorization, voting power) is performed by the Move prologue in `transaction_limits::validate_high_txn_limits`.

### Gas metering

The gas meter receives `Option<&TxnLimitsRequest>` and configures limits accordingly:

| Request | Execution limit | IO limit | Storage limit |
|---------|----------------|----------|---------------|
| `None` | `max_execution_gas` | `max_io_gas` | `max_storage_fee` |
| `ApprovedGovernanceScript` | `max_execution_gas_gov` | `max_io_gas_gov` | `max_storage_fee_gov` |
| `Staking(req)` | `max_execution_gas * execution_bps / 100` | `max_io_gas * io_bps / 100` | `max_storage_fee` (unchanged) |

Storage limits are intentionally not multiplied for staking-backed requests.

### Error codes

New `StatusCode` values for prologue failures:

| StatusCode | Code | Meaning |
|------------|------|---------|
| `NOT_STAKE_POOL_OWNER` | 46 | Sender does not hold an `OwnerCapability` |
| `NOT_DELEGATED_VOTER` | 47 | Sender is not the delegated voter of the specified stake pool |
| `INSUFFICIENT_STAKE` | 48 | Committed stake is too low for the requested multiplier tier |
| `INVALID_HIGH_TXN_LIMITS_MULTIPLIER` | 49 | Multiplier is <= 100 bps (i.e. <= 1x) |
| `STAKE_POOL_NOT_FOUND` | 50 | No stake pool exists at the specified address |
| `DELEGATION_POOL_NOT_FOUND` | 51 | No delegation pool exists at the specified address |
| `MULTIPLIER_NOT_AVAILABLE` | 52 | Requested multiplier exceeds all configured tiers |

Aborts from the `transaction_limits` module are routed through a dedicated error conversion path, separate from `transaction_validation` module aborts.

## Reference Implementation

PR: https://github.com/aptos-labs/aptos-core/pull/19109

Feature flag: `TRANSACTION_LIMITS` (feature ID 111 in `features.move`).

## Testing

The `transaction_limits.move` module includes unit tests covering tier construction and validation logic:

- Tier creation rejects multipliers <= 1x (100 bps).
- Tier vectors must be monotonically ordered (non-decreasing stakes, strictly increasing multipliers).
- Tier matching rounds up to the smallest tier >= the requested multiplier.
- Requesting a multiplier beyond all configured tiers is rejected.
- Stake validation checks execution and IO thresholds independently.

End-to-end Move tests (`e2e-move-tests/src/tests/transaction_limits.rs`) covering:

- **Feature gating**: Transaction is discarded with `FEATURE_UNDER_GATING` when the feature flag is off.
- **Stake pool owner (happy path)**: Owner of a stake pool with sufficient stake can request higher limits.
- **Delegated voter (happy path)**: A delegated voter of a stake pool can request limits using the pool's stake.
- **Delegation pool delegator (happy path)**: A delegator in a delegation pool can request limits using their committed stake.
- **Not pool owner**: Rejected with `NOT_STAKE_POOL_OWNER` when sender does not hold an `OwnerCapability`.
- **Not delegated voter**: Rejected with `NOT_DELEGATED_VOTER` when sender is not the pool's delegated voter.
- **Delegation pool not found**: Rejected with `DELEGATION_POOL_NOT_FOUND` when no delegation pool exists at the specified address.
- **Insufficient stake**: Rejected with `INSUFFICIENT_STAKE` when requesting a tier the committed stake doesn't qualify for.
- **Stake pool not found**: Rejected with `STAKE_POOL_NOT_FOUND` when no stake pool exists at the specified address.
- **Normal transactions unaffected**: Standard transactions work as before.
- **Independent IO thresholds**: A request may pass the execution threshold but fail the IO threshold, verifying that they are checked independently.

## Risks and Drawbacks

- **Stake concentration advantage.** Large stakers (exchanges, custodians) naturally have more committed stake and therefore qualify for higher tiers. This is by design since it ties the privilege to economic stake, but it means smaller participants cannot access higher multipliers.
- **Delegated voter indirection.** A stake pool owner can set any address as delegated voter, effectively granting elevated limits to that address. If a pool owner's key is compromised, the attacker can delegate voter rights to their own address.
- **IO amplification.** High IO multipliers let a single transaction perform significantly more state reads/writes. This is mitigated by the high stake requirements for upper tiers and the 10x gas price floor.
- **Storage limits unchanged.** Storage fees are not multiplied, which limits how much new state a high-limit transaction can create. This is intentional to bound state growth.

## Security Considerations

1. **Staking proof.** Authorization is validated on-chain by the Move prologue against live staking state. Ownership, delegation, and delegator relationships cannot be forged without controlling the relevant keys.
2. **Governance injection safety.** The `ApprovedGovernanceScript` variant is set only by the VM when the script hash matches `ApprovedExecutionHashes`. It is never deserialized from user-submitted BCS. A user payload containing governance-like data would only ever be interpreted as a `Staking(...)` variant.
3. **Gas price floor.** The 10x minimum gas price makes high-limit transactions at least 10x more expensive per gas unit, discouraging frivolous use.
4. **Multiplier validation.** Multipliers must be > 100 bps (> 1x) and must match a configured tier. This is enforced in the Move prologue. Basis-point arithmetic uses `saturating_mul` in the gas meter to prevent overflow.
5. **Stake is epoch-dependent.** A user's eligibility can change between epochs as stake is added or removed. The prologue reads current on-chain staking state, so eligibility is always up to date.
6. **No per-epoch cap.** There is no artificial limit on how many high-limit transactions can occur per epoch. Rate limiting is implicit through the staking requirement and gas price floor.
7. **Tier monotonicity enforcement.** The `validate_tiers` function ensures that tiers are well-ordered. Governance cannot accidentally create a config where a lower stake unlocks a higher multiplier.

## Future Potential

- **Additional limit dimensions.** The `RequestedMultipliers` enum can be extended to cover new dimensions (e.g. transaction size, storage) via a V2 variant, without changing the tier machinery.
- **Storage limit multipliers.** If needed, storage could be added as a third multiplier dimension, though this requires careful analysis of state growth implications.
- **SDK and CLI integration.** Wallet and CLI tooling can expose high-limit transaction construction as a first-class feature for stakers.
- **Dynamic thresholds.** Thresholds could be adjusted automatically based on total staked supply or network load.

## Timeline

TBD.
