---
aip: 145
title: Multisig Account Timelock
author: gregnazario (https://github.com/gregnazario)
discussions-to: https://github.com/aptos-foundation/AIPs/pull/667
Status: Draft
type: Standard (Framework)
created: 04/09/2026
updated: 04/10/2026
requires: AIP-12, AIP-77
---

# AIP-145 - Multisig Account Timelock

## Summary

This AIP proposes adding an opt-in timelock mechanism to Aptos multisig accounts. Once a transaction is proposed, execution is delayed by a configurable period (1 hour to 14 days) from the time of creation. An optional, higher signature threshold can be configured to bypass the timelock and allow immediate execution when urgency demands it.

## Motivation

Multisig accounts on Aptos are used to manage treasuries, upgrade smart contracts, and govern DAOs. Today, once a transaction reaches the required number of approvals, any owner can execute it immediately. This creates risk in several scenarios:

1. **Compromised keys**: If an attacker compromises enough owner keys to meet quorum, they can drain funds or execute malicious upgrades instantly, leaving no time for detection or response.
2. **Social engineering**: An owner could be tricked into approving a malicious transaction. Without a delay, there is no window for other owners to review and reject before execution.
3. **Operational safety**: Organizations often want a "cool-down" period between approval and execution to allow for final review, compliance checks, or stakeholder notification.

Timelocks are a well-established pattern in blockchain governance (e.g., Compound's Timelock, OpenZeppelin's TimelockController). This proposal brings the same protection to Aptos multisig accounts while preserving the ability to act quickly via an optional higher approval threshold when genuinely needed.

## Impact

- **Existing multisig accounts**: Completely unaffected. The timelock is opt-in; accounts without it configured continue to work exactly as before.
- **New and upgraded accounts**: Owners can configure a timelock at any time via a multisig transaction. Once configured, all subsequent executions are subject to the delay unless the optional bypass threshold is met.
- **Wallet and SDK developers**: Should surface the timelock status (duration and override threshold) in their UIs and handle the `ETIMELOCK_NOT_EXPIRED` prologue error gracefully (e.g., showing "Transaction is timelocked until ...").
- **Rejections are unaffected**: The timelock applies only to execution, not rejection. If enough owners reject a transaction, it can be removed immediately. The timelock protects against hasty *execution*, not hasty *cancellation*.

## Specification

### New Resource

A new versioned enum resource is stored at the multisig account address alongside the existing `MultisigAccount`:

```move
enum MultisigAccountTimeLock has key, drop {
    V1 {
        /// The time lock period in seconds after the creation of the multisig transaction.
        timelock_period: u64,
        /// The number of approvals required to bypass the timelock and execute immediately.
        /// Must be greater than the number of signatures required normally
        /// and less than or equal to the number of owners.
        /// None means no bypass is available — the timelock always applies.
        override_threshold: Option<u64>,
    }
}
```

A separate resource is used because Move structs that are already stored on-chain cannot have new fields added. This preserves full backward compatibility with the existing `MultisigAccount` and `MultisigTransaction` structs. A versioned enum (rather than a plain struct) allows future extensions without breaking on-chain state. The `drop` ability allows the resource to be cleanly removed when the timelock is disabled.

### Configuration

Timelock is configured via two new entry functions that can only be invoked as multisig transaction payloads (not `public`, preventing other modules from calling them with a borrowed signer):

```move
/// Configure or update the timelock. To set a timelock without bypass, pass option::none()
/// for override_threshold.
entry fun upsert_timelock(
    multisig_account: &signer,
    timelock_period: u64,
    override_threshold: Option<u64>,
);

/// Remove the timelock entirely.
entry fun remove_timelock(multisig_account: &signer);
```

**To enable with bypass**: `timelock_period` in valid range, `override_threshold = option::some(N)` where `N > num_signatures_required` and `N <= num_owners`.

**To enable without bypass**: `timelock_period` in valid range, `override_threshold = option::none()`. This is useful for cases like a 3-of-3 multisig where there is no higher threshold possible, but a timelock delay is still desired.

**To disable**: Call `remove_timelock`. This itself must go through the active timelock (the transaction must wait out the delay or meet the override threshold) since it is executed as a multisig transaction.

**Bounds**: `timelock_period` must be between `MIN_TIMELOCK_PERIOD` (3,600 seconds / 1 hour) and `MAX_TIMELOCK_PERIOD` (1,209,600 seconds / 14 days). The granularity is at the second level — these bounds simply prevent absurdly short or long timelocks.

### Execution Logic

A transaction can be executed when:

1. It has reached approval quorum (`num_approvals >= num_signatures_required`), AND either:
   - **(a)** An override threshold is configured and the number of approvals meets it (`override_threshold.is_some() && num_approvals >= override_threshold`), allowing immediate execution, OR
   - **(b)** Sufficient time has elapsed since the transaction was *created*: `now_seconds() - creation_time_secs >= timelock_period`.

If neither condition is met, the transaction prologue rejects with `ETIMELOCK_NOT_EXPIRED`.

The timelock is measured from the transaction's `creation_time_secs`, not from when quorum was reached. This simplifies the design — there is no need to track separate approval timestamps — and provides a predictable, auditable delay window.

### Invariant Enforcement

When the timelock is active with an override threshold configured, the following invariants are maintained:

1. `override_threshold > num_signatures_required`
2. `override_threshold <= owners.length()`

These are enforced when configuring the timelock (`upsert_timelock`) and when owners or thresholds change (`update_owner_schema`). If an owner removal would cause `override_threshold > num_owners`, the override threshold is automatically reduced to the new owner count. If a threshold increase would cause `override_threshold <= num_signatures_required`, the operation is rejected.

When `override_threshold` is `None`, these invariants are not applicable and no bypass is available.

### New Error Codes

| Code | Name | Description |
|------|------|-------------|
| 2012 | `ETIMELOCK_NOT_EXPIRED` | Prologue error: quorum met but timelock delay has not elapsed and override threshold not met |
| 21 | `EINVALID_TIMELOCK_DURATION` | `timelock_period` outside valid range (1 hour – 14 days) |
| 22 | `EINVALID_TIMELOCK_OVERRIDE_THRESHOLD` | `override_threshold` not in valid range relative to `num_signatures_required` and owner count |

### New Events

```move
#[event]
struct TimelockUpdated has drop, store {
    multisig_account: address,
    timelock_period: u64,
    override_threshold: Option<u64>,
}

#[event]
struct TimelockRemoved has drop, store {
    multisig_account: address,
}
```

### New View Functions

```move
#[view]
/// Return the timelock duration in seconds, or 0 if no timelock is configured.
public fun timelock_period(multisig_account: address): u64;

#[view]
/// Return the override threshold, or option::none() if no timelock or no bypass is configured.
public fun timelock_override_threshold(multisig_account: address): Option<u64>;
```

## Implementation Details

The timelock check is integrated into the existing `can_execute_with_timelock` function, which is called during both `can_execute` (view) and `validate_multisig_transaction` (prologue). The logic:

1. If no `MultisigAccountTimeLock` resource exists, execution is allowed (backward compatible).
2. Compute elapsed time: `now_seconds() - pending_transaction.creation_time_secs`.
3. If override threshold is configured and approvals meet it, allow immediate execution.
4. Otherwise, require `elapsed >= timelock_period`.

Owner/threshold changes in `update_owner_schema` automatically adjust the override threshold downward if it would exceed the new owner count, and reject changes that would make the override threshold invalid.

### Changes to Existing Functions

| Function | Change |
|----------|--------|
| `vote_transanction` | Integrates timelock-aware execution check |
| `validate_multisig_transaction` | Separates quorum check from timelock check with distinct error codes |
| `update_owner_schema` | Validates and auto-adjusts timelock override invariants after owner/threshold changes |

**No existing struct definitions change.**

### Behavioral Notes

- **3-of-3 multisig with timelock**: By passing `override_threshold = option::none()`, a 3-of-3 multisig (where no higher threshold is possible) can still use a timelock. All transactions must wait the full delay — there is no bypass.
- **Timelock measured from creation**: The delay starts when the transaction is proposed, not when it reaches quorum. This means the timelock may already be partially or fully elapsed by the time enough approvals are gathered, which is the expected behavior — the delay exists to give all owners time to review, and that review period begins at proposal time.
- **Removing the timelock requires going through the timelock**: Since `remove_timelock` is itself a multisig transaction, it must satisfy the active timelock before it can execute. An attacker who compromises enough keys for regular quorum but not the override threshold cannot immediately disable the timelock.

## Reference Implementation

https://github.com/gregnazario/aptos-core/tree/multisig-timelock

## Testing

The implementation includes unit tests covering:

| Test | What it validates |
|------|-------------------|
| `test_upsert_timelock` | Configure timelock, verify via view functions, update, then remove |
| `test_upsert_timelock_invalid_duration_should_fail` | Duration outside bounds rejected |
| `test_upsert_timelock_override_not_greater_than_threshold_should_fail` | `override <= num_signatures_required` rejected |
| `test_upsert_timelock_override_exceeds_owners_should_fail` | `override > num_owners` rejected |
| `test_execute_before_timelock_expires_should_fail` | Execution blocked during delay period |
| `test_execute_after_timelock_expires` | Execution succeeds after delay elapses |
| `test_execute_with_override_skips_timelock` | Override threshold allows immediate execution |
| `test_no_timelock_executes_normally` | Existing behavior unchanged without timelock |
| `test_remove_timelock_allows_immediate_execution` | Removing timelock restores immediate execution |
| `test_remove_owners_adjusts_override` | Owner removal auto-adjusts override threshold downward |
| `test_update_threshold_invalidates_override_should_fail` | Threshold increase blocked if it breaks override invariant |

These will also be tested on devnet and testnet prior to mainnet deployment.

## Security Considerations

- **Timelock protects against key compromise**: A configurable delay gives honest owners time to detect unauthorized activity and reject malicious transactions before execution.
- **Override threshold is a deliberate escape hatch**: The optional higher threshold allows rapid response when genuinely needed (e.g., emergency security patches) while still requiring broader consensus than normal operations.
- **Disabling the timelock requires going through the timelock**: An attacker who compromises enough keys to meet regular quorum but not the override threshold cannot immediately disable the timelock — they must wait out the delay, during which the attack can be detected.
- **Rejections bypass the timelock**: This is intentional. If owners detect a malicious pending transaction, they should be able to remove it immediately without waiting.
- **No existing behavior changes**: The feature is purely additive. Accounts that do not opt in are completely unaffected.

## Timeline

### Suggested deployment timeline

This feature will be included in a future framework release, gated behind a feature flag.
