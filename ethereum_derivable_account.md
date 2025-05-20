---
aip: 122
title: x-chain DAA authentication using Sign-in-With-Ethereum
author: igor-aptos, brian, 0xmaayan, hardsetting
Status: Draft
type: Framework
discussions-to (*optional): https://github.com/aptos-foundation/AIPs/issues/601
created: 04/17/2025
---

# AIP-X - x-chain DAA authentication using Sign-in-With-Ethereum

## Summary

Implements authentication function giving Ethereum users native Aptos accounts,
and allowing them to sign transaction on Aptos blockchain, directly from their Ethereum wallet (verified with Metamask).
This is done using derivable account abstraction (AIP-113).

## High-level Overview

Allow Ethereum accounts (Ethereum secp256k1 private keys inside Metamask Wallets) to create Aptos transactions,
and be able to autheneticate and execute them directly on the Aptos blockchain, without interaction with Ethereum Blockchain.
We do so by utilizing ["Sign-in-with-Ethereum"](https://docs.metamask.io/wallet/how-to/sign-data/siwe/) specification, and defining
a message format that gives enough details to users so they understand what they are signing reasonably well.

## Impact

This will allow users with Ethereum Wallets to be able to interact with Aptos blockchain

## Alternative Solutions

Alternatively, wallets from other chains can implement integration with Aptos natively, providing more seamless experience to the users.

## Specification and Implementation Details

dApp is required to issue Sign-in-with-Ethereum request to the wallet with:

```
<domain> wants you to sign in with your Ethereum account:
<ethereum_address>

Please confirm you explicitly initiated this request from <domain>. You are approving to execute transaction <entry_function> on Aptos blockchain (<network_name>).

URI: <scheme>://<domain>
Version: 1
Chain ID: <aptos_chain_id>
Nonce: <aptos_txn_digest>
Issued At: <date_iso_string>
```

And submit transaction to Aptos with Authenticator:

```
AccountAuthenticator::Abstraction {
    function_info: FunctionInfo::from("0x1::ethereum_derivable_account::authenticate"),
    auth_data: AbstractionAuthData::DerivableV1 {
        signing_message_digest: aptos_txn_digest,
        abstract_signature: bcs::to_bytes(SIWEAbstractSignature::EIP1193DerivedSignature {
            scheme: url_scheme,
            issued_at: date_iso_string,
            signature: sign_in_with_ethereum_signature,
        }),
        abstract_public_key: bcs::to_bytes(SIWEAbstractPublicKey {
            ethereum_address,
            domain,
        }),
    },
}
```

with types:

```
enum SIWEAbstractSignature has drop {
  EIP1193DerivedSignature {
      scheme: String,
      issued_at: String,
      signature: vector<u8>,
  },
}

struct SIWEAbstractPublicKey has drop {
  ethereum_address: vector<u8>,
  domain: vector<u8>,
}
```

And above message will be authorized with `0x1::ethereum_derivable_account::authenticate`,
for aptos account with address derevied from function_info and abstract_public_key with account_abstraction::derive_account_address.

`0x1::ethereum_derivable_account::authenticate` will generate the required text message format,
and verify that `sign_in_with_ethereum_signature` from `abstract_signature` is
correct signature of that message, and will recover the `account_address` from the `abstract_public_key` and verify it mathces with
the `ethereum_address`.

Looking at what each field in the message is and what is it used for:

- `domain` is a website domain issuing request to Solana Wallet, that Wallet itself will verify is correct.
  This sandboxes each `domain` into separate Aptos account, providing better isolation and security.
- `ethereum_address` is ethereum wallet account address including the `0x` prefix.
- `entry_function` is a string representation of an Aptos entry function transaction will execute. It contains address, module name and function name,
  for example `0x1::primary_fungible_store::transfer`.
  This restricts usage to only entry functions (i.e. preventing scripts, etc), but is made required as it is the main
  human-readable information about the transaction that user can read and understand.
- `network_name` is string representation of chain_id on which transaction can be executed on,
  with: "mainnet" for 1, "testnet" for 2, "local" for 4, and "custom network <chain_id>" for others
- `aptos_txn_digest` is the digest of the Aptos transaction that you want to execute. All details about the transaction itself,
  and replay protection is inside of the transaction. Note: "aptos_txn_digest" is guaranteed to be unique on Aptos, so it can be
  used raw directly as a nonce. Alternatively, it could've been designed to have aptos_txn_digest inside the message, and nonce be
  a separate user-controlled nonce, but that seems unnecessary.
- `aptos_chain_id` is number representation of chain_id on which transaction can be executed on,
  with: "mainnet" for 1, "testnet" for 2, "local" for 4, and "<chain_id>" for others
- `date_iso_string` is string representation of the timestamp the message was signed at.

Verification implementation is:

```
    public fun authenticate(account: signer, aa_auth_data: AbstractionAuthData): signer {
        let derivable_abstract_public_key = aa_auth_data.derivable_abstract_public_key();
        let abstract_public_key = deserialize_abstract_public_key(derivable_abstract_public_key);
        let digest_utf8 = string_utils::to_string(aa_auth_data.digest()).bytes();
        let abstract_signature = deserialize_abstract_signature(aa_auth_data.derivable_abstract_signature());
        let issued_at = abstract_signature.issued_at.bytes();
        let scheme = abstract_signature.scheme.bytes();
        let message = construct_message(&abstract_public_key.ethereum_address, &abstract_public_key.domain, entry_function_name, digest_utf8, issued_at, scheme);
        let public_key_bytes = recover_public_key(&abstract_signature.signature, &message);

        // 1. Skip the 0x04 prefix (take the bytes after the first byte)
        let public_key_without_prefix = vector::slice(&public_key_bytes, 1, vector::length(&public_key_bytes));
        // 2. Run Keccak256 on the public key (without the 0x04 prefix)
        let kexHash = aptos_hash::keccak256(public_key_without_prefix);
        // 3. Slice the last 20 bytes (this is the Ethereum address)
        let recovered_addr = vector::slice(&kexHash, 12, 32);
        // 4. Remove the 0x prefix from the base16 account address
        let ethereum_address_without_prefix = vector::slice(&abstract_public_key.ethereum_address, 2, vector::length(&abstract_public_key.ethereum_address));

        let account_address_vec = base16_utf8_to_vec_u8(ethereum_address_without_prefix);
        // Verify that the recovered address matches the domain account identity
        assert!(recovered_addr == account_address_vec, EADDR_MISMATCH);
    }
```

## Reference Implementation

https://github.com/aptos-labs/aptos-core/pull/16367

## Testing

Verified payload signed with Sign-in-with-Ethereum with Metamask is verified correctly and passes authorization

## Security Considerations, Risks and Drawbacks

- If Sign-in-with-Ethereum is used in the Wallet, `domain` is verified, and warning is given to the user. If user ignores the warning - they
  will allow diffent (potentially malicious) websites to execute transactions
- If the wallet does not implement Sign-in-with-Ethereum and the regular `persoanl_message` method is used directly (which is generally discouraged from users to sign), `domain` will not be verified,
  and it is on the user to understand risks
- Using this flow doesn't provide "simulation" information to the user (dapp could run simulation, but cannot be forced to), so user has less information about what is being signed.
  For that, direct wallet support would be needed.
- Without simulation, entry function is places inside the message, to help user understand better what it is authorizing. This is a balance between given user too much information
  (so it doesn't review it closely), like full json representation of the Aptos transaction, and having users sign without much information. It is a question if adding arguments to the entry function within the message itself is useful, they can give more context, but can also be quite large and hardly understandable.
- Note that actual address of the module where entry function is will be printed, while a lot UIs (explorer, wallet, etc) might maintain list of common ecosystem projects and addresses,
  and give users more easily understandable name. In order to do so here, we would need to maintain such list onchain, so there are tradeoffs to be considered.

## Future Potential

- `SIWEAbstractSignature` is enum, so that we can support new message formats in the future.
  For example, we could add list of permissions from AIP-103 to be listed, giving a restricted access to the transaction itself
  - it also allow us, in case a security issue is found, to deprecate current message format while keeping access to the account

## Timeline

### Suggested implementation timeline

Implemented.

### Suggested developer platform support timeline

Implemented.

### Suggested deployment timeline

Expected to go into 1.30, and be enabled after extensive testing.
