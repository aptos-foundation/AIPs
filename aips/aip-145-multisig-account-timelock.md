---
aip: 145
title: Multisig Account Timelock
author: gregnazario (https://github.com/gregnazario)
discussions-to: <TODO>
Status: Draft
type: Standard (Framework)
created: 04/09/2026
updated:
requires: AIP-12, AIP-77
---

# AIP-145 - Multisig Account Timelock

## Summary

This AIP proposes adding an opt-in timelock mechanism to Aptos multisig accounts. Once a proposed transaction reaches approval quorum, execution is delayed by a configurable period (1 hour to 14 days). A separate, higher signature threshold can be configured to bypass the timelock and allow immediate execution when urgency demands it.

## Motivation

Multisig accounts on Aptos are used to manage treasuries, upgrade smart contracts, and govern DAOs. Today, once a transaction reaches the required number of approvals, any owner can execute it immediately. This creates risk in several scenarios:

1. **Compromised keys**: If an attacker compromises enough owner keys to meet quorum, they can drain funds or execute malicious upgrades instantly, leaving no time for detection or response.
2. **Social engineering**: An owner could be tricked into approving a malicious transaction. Without a delay, there is no window for other owners to review and reject before execution.
3. **Operational safety**: Organizations often want a "cool-down" period between approval and execution to allow for final review, compliance checks, or stakeholder notification.

Timelocks are a well-established pattern in blockchain governance (e.g., Compound's Timelock, OpenZeppelin's TimelockController). This proposal brings the same protection to Aptos multisig accounts while preserving the ability to act quickly via a higher approval threshold when genuinely needed.

## Impact

- **Existing multisig accounts**: Completely unaffected. The timelock is opt-in; accounts without it configured continue to work exactly as before.
- **New and upgraded accounts**: Owners can configure a timelock at any time via a multisig transaction. Once configured, all subsequent executions are subject to the delay unless the bypass threshold is met.
- **Wallet and SDK developers**: Should surface the timelock status (duration and bypass threshold) in their UIs and handle the `ETIMELOCK_NOT_EXPIRED` prologue error gracefully (e.g., showing "Transaction is timelocked until ...").
- **Rejections are unaffected**: The timelock applies only to execution, not rejection. If enough owners reject a transaction, it can be removed immediately. The timelock protects against hasty *execution*, not hasty *cancellation*.

## Specification

### New Resource

A new resource is stored at the multisig account address alongside the existing `MultisigAccount`:

```move
struct MultisigAccountTimelock has key {
    /// Seconds that must elapse after quorum before execution is allowed.
    timelock_secs: u64,
    /// Number of approvals that bypass the timelock for immediate execution.
    /// Must be > num_signatures_required and <= num_owners when active.
    bypass_num_signatures: u64,
    /// Maps transaction sequence_number -> timestamp when quorum was first reached.
    approval_timestamps: Table<u64, u64>,
}
```

A separate resource is used because Move structs that are already stored on-chain cannot have new fields added. This preserves full backward compatibility with the existing `MultisigAccount` and `MultisigTransaction` structs.

### Configuration

Timelock is configured via a new entry function that can only be invoked as a multisig transaction payload (not `public`, preventing other modules from calling it with a borrowed signer):

```move
entry fun update_timelock(
    multisig_account: &signer,
    new_timelock_secs: u64,
    new_bypass_num_signatures: u64,
) acquires MultisigAccount, MultisigAccountTimelock;
```

**To enable**: `new_timelock_secs > 0` and `new_bypass_num_signatures > num_signatures_required` and `new_bypass_num_signatures <= num_owners`.

**To disable**: `new_timelock_secs = 0` and `new_bypass_num_signatures = 0`. Disabling itself goes through the active timelock (the transaction must wait out the delay or meet the bypass threshold).

**Bounds**: `timelock_secs` must be between `MIN_TIMELOCK_PERIOD` (3,600 seconds / 1 hour) and `MAX_TIMELOCK_PERIOD` (1,209,600 seconds / 14 days).

### Execution Logic

A transaction can be executed when:

1. It has reached approval quorum (`num_approvals >= num_signatures_required`), AND either:
   - **(a)** The number of approvals meets the bypass threshold (`num_approvals >= bypass_num_signatures`), allowing immediate execution, OR
   - **(b)** Sufficient time has elapsed since quorum was first reached: `now_seconds() >= approval_timestamp + timelock_secs`.

If neither condition is met, the transaction prologue rejects with `ETIMELOCK_NOT_EXPIRED`.

### Approval Timestamp Tracking

The `approval_timestamps` table records when each transaction first reached quorum:

| Scenario | Behavior |
|----------|----------|
| k-th approval meets quorum | Timestamp recorded with `now_seconds()` |
| Additional approval after quorum | Timestamp preserved (clock does NOT restart) |
| Vote change causes quorum loss | Timestamp removed (clock resets) |
| Quorum restored after loss | New timestamp recorded (clock restarts) |
| Transaction executed or rejected | Timestamp entry cleaned up |
| 1-of-N multisig, creator proposes | Timestamp set at creation (auto-approval meets quorum) |

### Invariant Enforcement

When the timelock is active, the following invariants are maintained:

1. `bypass_num_signatures > num_signatures_required`
2. `bypass_num_signatures <= owners.length()`

These are enforced both when configuring the timelock (`update_timelock`) and when owners or thresholds change (`update_owner_schema`). Owner removals or threshold increases that would violate these invariants are rejected.

### New Error Codes

| Code | Name | Description |
|------|------|-------------|
| 2012 | `ETIMELOCK_NOT_EXPIRED` | Prologue error: quorum met but timelock delay has not elapsed |
| 21 | `EINVALID_TIMELOCK_CONFIG` | `timelock_secs` and `bypass_num_signatures` must both be positive or both zero |
| 22 | `EINVALID_TIMELOCK_DURATION` | `timelock_secs` outside valid range (1 hour – 14 days) |
| 23 | `EINVALID_TIMELOCK_BYPASS_THRESHOLD` | `bypass_num_signatures` not in valid range |

### New Event

```move
#[event]
struct TimelockUpdated has drop, store {
    multisig_account: address,
    old_timelock_secs: u64,
    new_timelock_secs: u64,
    old_bypass_num_signatures: u64,
    new_bypass_num_signatures: u64,
}
```

### New View Functions

```move
#[view]
public fun timelock_secs(multisig_account: address): u64;

#[view]
public fun timelock_bypass_num_signatures(multisig_account: address): u64;
```

Both return `0` if no timelock is configured.

## Implementation Details

All timelock resource access is encapsulated in four non-inline helper functions:

1. **`maybe_update_approval_timestamp`** — Called after every vote and transaction creation. Records or removes the quorum timestamp.
2. **`assert_timelock_expired`** — Called during `validate_multisig_transaction` (prologue). Enforces the delay or bypass.
3. **`maybe_remove_approval_timestamp`** — Called on transaction execution or rejection. Cleans up the timestamp entry.
4. **`validate_timelock_invariants`** — Called after owner/threshold changes. Ensures bypass invariants hold.

Because these are non-inline functions, their `acquires MultisigAccountTimelock` annotation does **not** propagate to callers. This means no existing function signature or `acquires` clause changes — full ABI compatibility.

### Changes to Existing Functions

| Function | Change |
|----------|--------|
| `vote_transanction` | Calls `maybe_update_approval_timestamp` after recording the vote |
| `add_transaction` | Calls `maybe_update_approval_timestamp` after creator auto-approval |
| `validate_multisig_transaction` | Computes effective approvals (including implicit executor vote), calls `assert_timelock_expired` |
| `transaction_execution_cleanup_common` | Calls `maybe_remove_approval_timestamp` |
| `execute_rejected_transaction` | Calls `maybe_remove_approval_timestamp` |
| `update_owner_schema` | Calls `validate_timelock_invariants` at the end |

**No existing struct definitions change. No existing function signatures change.**

### Behavioral Notes

- **Implicit executor vote**: When the v2 enhancement feature is enabled, the executor's implicit approval counts toward both the regular and bypass thresholds. However, if the implicit vote is what first reaches quorum, no timestamp exists yet — the executor must first explicitly approve (starting the clock), wait out the timelock, then execute. This prevents timelock circumvention via implicit votes.
- **Enabling on existing accounts**: Pending transactions that already have quorum will NOT have timestamps recorded. A fresh vote (even a redundant re-approval) is needed to start the clock. This is intentional — enabling a timelock is a security hardening step.
- **Overflow prevention**: Time comparison uses `now_seconds() - approval_time >= timelock_secs` (subtraction-based) rather than `now_seconds() >= approval_time + timelock_secs` to prevent potential overflow.

## Reference Implementation

https://github.com/gregnazario/aptos-core/tree/multisig-timelock

## Testing

The implementation includes 13 unit tests covering:

| Test | What it validates |
|------|-------------------|
| `test_update_timelock` | Configure timelock, verify via view functions, then disable |
| `test_update_timelock_invalid_config_should_fail` | Mixed zero/non-zero config rejected |
| `test_update_timelock_bypass_not_greater_than_threshold_should_fail` | `bypass <= num_signatures_required` rejected |
| `test_update_timelock_bypass_exceeds_owners_should_fail` | `bypass > num_owners` rejected |
| `test_execute_before_timelock_expires_should_fail` | Execution blocked during delay period |
| `test_execute_after_timelock_expires` | Execution succeeds after delay elapses |
| `test_execute_with_bypass_skips_timelock` | Bypass threshold allows immediate execution |
| `test_timelock_resets_when_quorum_lost` | Clock resets when quorum is lost and re-established |
| `test_timelock_set_immediately_for_single_sig` | 1-of-N: timestamp set at creation |
| `test_remove_owners_invalidates_bypass_should_fail` | Owner removal blocked if it breaks bypass invariant |
| `test_update_threshold_invalidates_bypass_should_fail` | Threshold increase blocked if it breaks bypass invariant |
| `test_no_timelock_executes_normally` | Existing behavior unchanged without timelock |
| `test_disable_timelock_allows_immediate_execution` | Disabling restores immediate execution |

These will also be tested on devnet and testnet prior to mainnet deployment.

## Security Considerations

- **Timelock protects against key compromise**: A configurable delay gives honest owners time to detect unauthorized activity and reject malicious transactions before execution.
- **Bypass threshold is a deliberate escape hatch**: The higher threshold allows rapid response when genuinely needed (e.g., emergency security patches) while still requiring broader consensus than normal operations.
- **Disabling the timelock requires going through the timelock**: An attacker who compromises enough keys to meet regular quorum but not the bypass threshold cannot immediately disable the timelock — they must wait out the delay, during which the attack can be detected.
- **Rejections bypass the timelock**: This is intentional. If owners detect a malicious pending transaction, they should be able to remove it immediately without waiting.
- **No existing behavior changes**: The feature is purely additive. Accounts that do not opt in are completely unaffected.

## Timeline

### Suggested deployment timeline

This feature will be included in a future framework release, gated behind a feature flag.
