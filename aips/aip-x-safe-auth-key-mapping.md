---
aip: (this is determined by the AIP Manager, leave it empty when drafting)
title: Safe onchain key rotation address mapping for standard accounts
author: Alex Kahn (43892045+alnoki@users.noreply.github.com)
Status: Draft
type: Standard (Framework)
created: 2024-09-17
---

# Problem statement

Aptos authentication key rotation is accompanied by a global mapping from an
authentication key to the address that it authenticates, the
`OriginatingAddress` table. For more background see the [key rotation docs] and
the [Ledger key rotation docs].

There are currently several issues with the `OriginatingAddress` table (which is
supposed to be a one-to-one lookup table) that render the mapping unsafe in
practice:

1. Per [`aptos-core` #13517], `rotate_authentication_key_call` does not update
   the `OriginatingAddress` table for an "unproven" key rotation without a
   `RotationProofChallenge` (resolved in this AIP's reference implementation
   with a new `set_originating_address` private entry function).
1. During an operation that attempts to map an authentication key (which has
   already been mapped) to a different originating address, the inner function
   `update_auth_key_and_originating_address_table` overwrites the initial
   mapping, rather than aborting. This oversight can lead to account loss if
   someone accidentally attempts to rotate to the same authentication key twice
   (resolved in this PR with `ENEW_AUTH_KEY_ALREADY_MAPPED` check), because they
   will not be able to identify their account from private key alone unless they
   keep an external record of the rotated accounts the private key in question
   has been used to secure.
1. Standard accounts that have not yet had their key rotated are not registered
   in the `OriginatingAddress` table, such that two accounts can be
   authenticated by the same authentication key: the original account whose
   address is its authentication key, and another account that has had its
   authentication key rotated to the authentication key of the original account.
   Since `OriginatingAddress` is one-to-one, a dual-account situation can
   inhibit indexing and OpSec (resolved in this PR with
   `set_originating_address` private entry function).

# Impact

1. Without the changes proposed in this AIP's reference implementation,
   unproven authentications (specifically those relying on
   `rotate_authentication_key_call`) will result in an unidentifiable mapping,
   such that users will be unable to identify accounts secured by their private
   key unless they have maintained their own offchain mapping. This applies to
   exotic wallets like passkeys.
1. The overwrite behavior (described above) for
   `update_auth_key_and_originating_address_table` can similarly result in an
   inability to identify an account based on the private key.
1. A user who authenticates two accounts with the same private key per the above
   schema will experience undefined behavior during indexing and OpSec due to
   the original one-to-one mapping assumption.

# Summary

The onchain key rotation address mapping has functional issues which inhibit
safe mapping of authentication key to originating address for standard accounts.
I propose resolving these issues with the reference implementation.

# Proposed solution

Assorted checks and extra function logic in [`aptos-core` #14309]

# Alternative solutions

Per @davidiw in a separate chat:

> something where we update the rotation command to take in new and removed keys
> as well as any additional metadata that might be useful such as parameters for
> the authkey type. Then we add to the indexer a set of all keys that point to
> potential addresses.

As I understand, this approach would require breaking changes and would
introduce offchain indexing as an additional dependency in the authentication
key mapping paradigm.

My solution, captured in the proposed reference implementation, offers a
purely onchain solution to existing issues and does not require altering the
existing design space or introducing an offchain dependency.

# Specification

N/A

# Reference implementations

[`aptos-core` #14309]

# Risks and drawbacks

Enforces a one-to-one mapping of private key to account address in the general
case of following best practices, which extreme users (wishing to use one
private key to authenticate all their accounts) may find restrictive.

# Security considerations

Note that the function `account::set_originating_address` proposed in
[`aptos-core` #14309] must remain a private entry function to prevent unproven
key rotation attacks.

# Multisig considerations

In a separate chat, @davidiw asked about how the changes in the reference
implementation will interact with multisig v2. Note that even without the
changes in this PR, it is already possible for a multisig to have an entry in
the `OriginatingAddress` table:

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

# Timelines

Ideally during next release

# Future potentials

Potentially in a separate update, logic to eradicate the existing multisig v2
indexing issues mentioned above (which is outside the scope of what the
reference implementation intends to resolve).

# Verifying changes in reference implementation

As requested by @thepom on 2024-09-17:

1. Install the Aptos CLI from source using the changes in [`aptos-core` #14309].
1. Make a new test directory called `localnet-data`, then use it to start a
   localnet with the framework changes in this PR:

    ```sh
    aptos node run-localnet --test-dir localnet-data
    ```

1. Save the localnet shell running off to the side.
1. In a new shell, create a private key file:

    ```sh
    aptos key generate --output-file keyfile-a
    ```

1. Use it to create a localnet profile:

    ```sh
    aptos init \
        --network local \
        --private-key-file keyfile-a \
        --profile localnet-a
    ```

1. Store the address:

    ```sh
    ADDR_A=<profile-address>
    ```

1. Use the new `originating_address` view function to observe that the account
   does *not* have an entry in the `OriginatingAddress` table:

    ```sh
    aptos move view \
        --args address:$ADDR_A \
        --function-id 0x1::account::originating_address \
        --profile localnet-a
    ```

1. Use the new `set_originating_address` private entry function to set a mapping
   in the table:

    ```sh
    aptos move run \
        --function-id 0x1::account::set_originating_address \
        --profile localnet-a
    ```

1. Check the `originating_address` view function again and note the result:

    ```sh
    aptos move view \
        --args address:$ADDR_A \
        --function-id 0x1::account::originating_address \
        --profile localnet-a
    ```

1. Now that you've established a one-to-one mapping for the authentication key,
   the new check for `ENEW_AUTH_KEY_ALREADY_MAPPED` in
   `update_auth_key_and_originating_address_table` will prevent another account
   from rotating its authentication key to that of `keyfile-a`, thus preserving
   a one-to-one mapping. To verify this, create a new profile:

    ```sh
    aptos init \
        --network local \
        --profile localnet-b
    ```

1. Press `enter` when prompted to generate a new private key for the profile.
   Then observe the new guard against breaking the one-to-one mapping, by
   trying to rotate the authentication key to that of `keyfile-a`:

    ```sh
    aptos account rotate-key \
        --new-private-key-file keyfile-a \
        --profile localnet-b \
        --save-to-profile localnet-b-secured-by-keyfile-a
    ```

[`aptos-core` #13517]: https://github.com/aptos-labs/aptos-core/pull/13517
[`aptos-core` #14309]: https://github.com/aptos-labs/aptos-core/pull/14309
[key rotation docs]: https://aptos.dev/en/build/guides/key-rotation
[Ledger key rotation docs]: https://aptos.dev/en/build/cli/trying-things-on-chain/ledger#authentication-key-rotation