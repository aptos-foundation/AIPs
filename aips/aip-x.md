---
aip: 
title: Private Entry Function for Multisig Account Creation
author: yeptos (https://github.com/yeptos), gregnazario (https://github.com/gregnazario)
discussions-to: https://github.com/aptos-foundation/AIPs/issues/498
Status: Draft
last-call-end-date:
type: Standard (Framework)
created: 9/10/2024
updated:
requires:
---

# AIP-X - Private Entry Function for Multisig Account Creation

## Summary

This AIP proposes adding new private entry functions to allow an existing Aptos account to create a multisig account using a signer, without requiring complex steps to generate a signature of a struct as proof. Currently, only accounts with Ed25519 and MultiEd25519 authentication schemes can migrate to multisig accounts. This enhancement will enable any account with any authentication key scheme to create a multisig account on top of it, providing a straightforward migration path from any accounts to multisig v2 accounts.

### Out of Scope

This AIP does not cover changes to other aspects of multisig account functionality beyond the creation process from an existing account.

## High-level Overview

The proposal introduces two new private entry functions in the `multisig_account` module:

- `create_with_existing_account_call`: Creates a new multisig account on top of an existing account without revoking the original auth key.

- `create_with_existing_account_and_revoke_auth_key_call`: Creates a new multisig account on top of an existing account and immediately rotates the original auth key to 0x0.

These functions simplify the process of creating a multisig account from an existing account, regardless of its authentication key scheme. This is particularly useful for migrating from multi-key accounts to multisig accounts, which is currently not possible.

This proposal mirrors changes implemented in commit [aptos-core@fdc041](https://github.com/aptos-labs/aptos-core/commit/fdc041f37e4cb17d2c7f4bb2e0ad784a3f007614), where a private entry function was introduced for account key rotation with a similar purpose.

## Impact

This change will impact developers and users who want to create multisig accounts from existing accounts, especially those with authentication schemes other than Ed25519 and legacy MultiEd25519. It provides a more inclusive and flexible method for account migration and multisig setup.

- Developers can now easily implement multisig account creation for any existing account type, not just those with Ed25519 and MultiEd25519 schemes.
- Users with existing accounts using any authentication scheme can now transition to multisig accounts, which was previously limited.
- This change enhances the usability and adoption of multisig accounts in the Aptos ecosystem, opening up new possibilities for account management and security across all account types.

## Alternative solutions

The currently existing multisig account creation functions, `create_with_existing_account` and `create_with_existing_account_and_revoke_auth_key`, require a signature of a struct as proof. However, the verification of this signature only works for Ed25519 and MultiEd25519 authentication schemes, excluding accounts with newer schemes like Multi-key or Keyless.

One alternative solution could be to upgrade the on-chain signature verification logic to support all signature types. However, this approach doesn't solve the usability issue of requiring users to sign a struct, which remains cumbersome regardless of the authentication scheme.

This proposal offers a more user-friendly approach by introducing new private entry functions that work with a signer, providing a simpler migration path for all account types, regardless of their authentication scheme.

## Specification and Implementation Details

This proposal introduces two new entry functions in the `multisig_account` module:

1. `create_with_existing_account_call`: Creates a multisig account without revoking the original auth key.
2. `create_with_existing_account_and_revoke_auth_key_call`: Creates a multisig account and rotates the original auth key to 0x0.

These functions are named following the convention of the `account::rotate_authentication_key_call` function, which similarly takes a signer instead of a signature as proof.

## Reference Implementation

https://github.com/aptos-labs/aptos-core/pull/14645

## Testing 

The implementation includes new unit tests in the `multisig_account.move` file:

- `test_create_multisig_account_on_top_of_existing_with_signer`: Tests creating a multisig account on top of an existing account using a signer
- `test_create_multisig_account_on_top_of_existing_and_revoke_auth_key_with_signer`: Tests creating a multisig account and revoking the auth key

These tests cover the basic functionality of the new functions.

## Risks and Drawbacks

The `create_with_existing_account_and_revoke_auth_key_call` function rotates the auth key to 0x0 and revokes capability offers, which irreversibly changes account control. Developers and users should be well-informed about this consequence.

For resource accounts or object accounts, alternative methods to obtain the signer may exist beyond the authentication key.

Note that these considerations also apply to the existing `create_with_existing_account_and_revoke_auth_key` function and are not newly introduced by this proposal.

## Security Considerations

The `create_with_existing_account_and_revoke_auth_key_call` function rotates the auth key to 0x0 and revokes capability offers, which irreversibly changes account control. Developers and users should be well-informed about this consequence.

## Future Potential

1. This change could lead to increased adoption of multisig accounts in the Aptos ecosystem.
2. It may inspire further improvements in account migration and management tools.
3. The simplified creation process could encourage the development of more complex governance structures built on multisig accounts.

## Timeline

### Suggested implementation timeline

Reference implementation with a pull request available: https://github.com/aptos-labs/aptos-core/pull/14645

### Suggested developer platform support timeline

No additional SDK support is required.

### Suggested deployment timeline

In the next release, upon further testing on devnet and testnet.
