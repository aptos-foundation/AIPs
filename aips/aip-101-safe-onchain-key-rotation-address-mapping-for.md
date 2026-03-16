---
aip: 101
title: Safe onchain key rotation address mapping for standard accounts
author: Alex Kahn (43892045+alnoki@users.noreply.github.com)
discussions-to (*optional): https://github.com/aptos-foundation/AIPs/issues/487
Status: Draft
last-call-end-date (*optional): <mm/dd/yyyy the last date to leave feedbacks and reviews>
type: Standard Framework
created: 09/17/2024
updated (*optional): <mm/dd/yyyy>
requires (*optional): <AIP number(s)>
---

# AIP-101 - Safe onchain key rotation address mapping for standard accounts

## Summary

The onchain key rotation address mapping has functional issues which inhibit
safe mapping of authentication key to originating address for standard accounts.
This proposal resolves these issues by adding assorted checks and extra function logic.

### Out of Scope

Note that this AIP does not attempt to address multisig v2 effects, because even
without the changes in this AIP, it is already possible for a multisig to
(misleadingly) generate an entry in the `OriginatingAddress` table:

1. Rotate account `A` to have a new authentication key, thus generating an entry
   in the `OriginatingAddress` table.
2. Convert account `A` to a multisig via
   `multisig_account::create_with_existing_account_and_revoke_auth_key`, which
   will set the account's authentication key to `0x0`, but which will *not*
   mutate the `OriginatingAddress` table, since it makes an inner call to
   `account::rotate_authentication_key_internal`.
3. The `OriginatingAddress` table then (incorrectly) reports that a mapping from
   the authentication key (from before multisig conversion) to the multisig
   address.

## Impact

1. Without the changes proposed in this AIP's reference implementation,
   unproven authentications (specifically those relying on
   `rotate_authentication_key_call`) will result in an unidentifiable mapping,
   such that users will be unable to identify accounts secured by their private
   key unless they have maintained their own offchain mapping. This applies to
   exotic wallets like passkeys.
1. The overwrite behavior (described below) for
   `update_auth_key_and_originating_address_table` can similarly result in an
   inability to identify an account based on the private key.
1. A user who authenticates two accounts with the same private key per the below
   schema will experience undefined behavior during indexing and OpSec due to
   the original one-to-one mapping assumption.

## Alternative solutions

One alternative would be a primarily offchain and indexing-based
approach to mapping authentication keys.

However, such an approach would require breaking changes and would introduce
offchain indexing as an additional dependency in the authentication key mapping
paradigm.

The proposed solution offers a purely onchain solution to existing issues and does not require altering the existing design space or introducing an offchain dependency.

## Specification and Implementation Details

Aptos authentication key rotation is accompanied by a global mapping from an
authentication key to the address that it authenticates, the
`OriginatingAddress` table. For more background see the [key rotation docs](https://aptos.dev/en/build/guides/key-rotation) and
the [Ledger key rotation docs](https://aptos.dev/en/build/cli/trying-things-on-chain/ledger#authentication-key-rotation).

There are currently several issues with the `OriginatingAddress` table (which is
supposed to be a one-to-one lookup table) that render the mapping unsafe in
practice:

1. Per [`aptos-core` #13517](https://github.com/aptos-labs/aptos-core/pull/13517), `rotate_authentication_key_call` does not update
   the `OriginatingAddress` table for an "unproven" key rotation without a
   `RotationProofChallenge` (resolved in this AIP's reference implementation
   with a new `set_originating_address` private entry function).
1. When a given authentication key already has an entry in the
   `OriginatingAddress` table (`t[ak] = a1`) and a key rotation operation
   attempts to establish a mapping to a new account address, (`t[ak] = a2`), the
   inner function `update_auth_key_and_originating_address_table` silently
   overwrites the existing mapping rather than aborting, such that the owner of
   authentication key `ak` is unable to identify account address `a1` purely
   onchain from authentication key `ak`. Hence account loss may ensure if
   someone accidentally maps the same authentication key twice but does not keep
   an offchain record of all authenticated accounts (resolved in reference
   implementation with `ENEW_AUTH_KEY_ALREADY_MAPPED` check).
1. Standard accounts that have not yet had their key rotated are not registered
   in the `OriginatingAddress` table, such that two accounts can be
   authenticated by the same authentication key: the original account whose
   address is its authentication key, and another account that has had its
   authentication key rotated to the authentication key of the original account.
   (This situation is possible even with proposed `ENEW_AUTH_KEY_ALREADY_MAPPED`
   since account initialization logic does not create an `OriginatingAddress`
   entry for a standard account when it is first initialized). Hence since
   `OriginatingAddress` is intended to be one-to-one, a dual-account situation
   can inhibit indexing and OpSec (resolved in reference implementation with
   `set_originating_address` private entry function, which allows setting a
   mapping for the original account address).

## Reference Implementation

Assorted checks and extra function logic in [`aptos-core` #14309](https://github.com/aptos-labs/aptos-core/pull/14309):

1. Function `set_originating_address()`: Private entry function to establish an
   `OriginatingAddress` mapping for account reconciliation after an unproven
   rotation or for an account that has just beencreated.
1. Function `originating_address()`: View function to return the address mapped
   to an authentication key
1. Abort `ENEW_AUTH_KEY_SAME_AS_CURRENT` to prevent no-op rotations that can
   introduce indexing issues.
1. Abort `ENEW_AUTH_KEY_ALREADY_MAPPED` to prevent onchain account loss
   from silent overwriting of existing mappings.

## Testing

The reference implementation pairs with a
[docs site walkthrough that I authored](https://aptos.dev/en/build/guides/key-rotation#key-rotation-with-the-aptos-cli), which demonstrates, documents,
and verifies the functionality from the reference implementation.

## Risks and drawbacks

This proposal enforces a one-to-one mapping of private key to account address in
the general case of following best practices, which extreme users (wishing to
use one private key to authenticate all their accounts) may find restrictive.

## Security considerations

Note that the function `account::set_originating_address` proposed in
[`aptos-core` #14309](https://github.com/aptos-labs/aptos-core/pull/14309) must remain a private entry function to prevent unproven
key rotation attacks.

## Future Potential

In a separate update, logic to eradicate the existing multisig v2 indexing
issues mentioned above (which is outside the scope of what the reference
implementation intends to resolve).

## Timeline

Ideally during next release
