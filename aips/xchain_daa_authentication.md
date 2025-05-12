---
aip: AIP-121
title: x-chain DAA authentication using Sign-in-With-Solana
author: igor-aptos, brian, 0xmaayan, lightmark, hardsetting
Status: Draft
type: Framework
discussions-to (*optional): https://github.com/aptos-foundation/AIPs/issues/600
created: 04/08/2024
---

# AIP-121 - x-chain DAA authentication using Sign-in-With-Solana
  
## Summary

Implements authentication function giving Solana users native Aptos accounts, 
and allowing them to sign transaction on Aptos blockchain, directly from their Solana wallet (verified with Phantom). 
This is done using derivable account abstraction (AIP-113).

## High-level Overview

Allow Solana accounts (Solana Ed25519 private keys inside Solana Wallets) to create Aptos transactions,
and be able to autheneticate and execute them directly on the Aptos blockchain, without interaction with Solana Blockchain.
We do so by utilizing ["Sign-in-with-Solana"](https://phantom.com/learn/developers/sign-in-with-solana) specification, and defining
a message format that gives enough details to users so they understand what they are signing reasonably well.

## Impact

This will allow users with Solana Wallets to be able to interact with Aptos blockchain 

## Alternative Solutions

Alternatively, wallets from other chains can implement integration with Aptos natively, providing more seamless experience to the users.

## Specification and Implementation Details

dApp is required to issue Sign-in-with-Solana request to the wallet with:
```
solanaWallet.signIn!{
    address: solana_base58_public_key,
    domain,
    nonce: aptos_txn_digest,
    statement: "Please confirm you explicitly initiated this request from <domain>. You are approving to execute transaction <entry_function_name> on Aptos blockchain (<network_name>).",
}
```

This will generate a signature of the following full message:

```
<domain> wants you to sign in with your Solana account:
<base58_public_key>

Please confirm you explicitly initiated this request from <domain>. You are approving to execute transaction <entry_function_name> on Aptos blockchain (<network_name>).

Nonce: <aptos_txn_digest>
```

And submit transaction to Aptos with Authenticator:

```
AccountAuthenticator::Abstraction {
    function_info: FunctionInfo::from("0x1::solana_derivable_account::authenticate"),
    auth_data: AbstractionAuthData::DerivableV1 {
        signing_message_digest: aptos_txn_digest,
        abstract_signature: bcs::to_bytes(SIWSAbstractSignature::RawSignature {
            signature: sign_in_with_solana_signature,
        }),
        abstract_public_key: bcs::to_bytes(SIWSAbstractPublicKey {
            base58_public_key,
            domain,
        }),
    },
}
```
with types:

```
    enum SIWSAbstractSignature {
        RawSignature {
            signature: Vec<u8>,
        },
    }
    struct SIWSAbstractPublicKey {
        base58_public_key: String,
        domain: String,
    }
```

And above message will be authorized with `0x1::solana_derivable_account::authenticate`, 
for aptos account with address derevied from function_info and abstract_public_key with account_abstraction::derive_account_address.

`0x1::solana_derivable_account::authenticate` will generate the required text message format, 
and verify that `sign_in_with_solana_signature` from `abstract_signature` is 
correct signature of that message, from a Ed25519 public_key from `abstract_public_key`.

Looking at what each field in the message is and what is it used for:
- `domain` is a website domain issuing request to Solana Wallet, that Wallet itself will verify is correct. 
  This sandboxes each `domain` into separate Aptos account, providing better isolation and security.
- `base58_public_key` is base58 representation of Ed25519 public key kept inside the Solana Wallet, 
  making sure that only owner can create such transactions
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

Verification implementation is:
```
    public fun authenticate(account: signer, aa_auth_data: AbstractionAuthData): signer {
        let entry_function_name = entry_function_name(transaction_context::entry_function_payload().destroy_some()
        let (base58_public_key, domain) = deserialize_abstract_public_key(aa_auth_data.derivable_abstract_public_key());
        let digest_utf8 = string_utils::to_string(aa_auth_data.digest()).bytes();

        let public_key = new_validated_public_key_from_bytes(to_public_key_bytes(&base58_public_key));
        assert!(public_key.is_some(), EINVALID_PUBLIC_KEY);
        let abstract_signature = deserialize_abstract_signature(aa_auth_data.derivable_abstract_signature());
        match (abstract_signature) {
            SIWSAbstractSignature::MessageV1 { signature: signature_bytes } => {
                let message = construct_message(&base58_public_key, &domain, entry_function_name, digest_utf8);

                let signature = new_signature_from_bytes(signature_bytes);
                assert!(
                    ed25519::signature_verify_strict(
                        &signature,
                        &public_key_into_unvalidated(public_key.destroy_some()),
                        message,
                    ),
                    EINVALID_SIGNATURE
                );
            },
        };
        account
    }
```

## Reference Implementation

https://github.com/aptos-labs/aptos-core/pull/16236#discussion_r2029411835

## Testing 

Verified payload signed with Sign-in-with-Solana with Phantom is verified correctly and passes authorization

## Security Considerations, Risks and Drawbacks 

- If Sign-in-with-Solana is used in the Wallet, `domain` is verified, and warning is given to the user. If user ignores the warning - they 
  will allow diffent (potentially malicious) websites to execute transactions
- If sign_message with above payload is used directly (which is generally discouraged from users to sign), `domain` will not be verified, 
  and it is on the user to understand risks. `Please confirm you explicitly initiated this request from <domain>. ` should help users check.
    - Wallets can better protect users by detecting the Sign-in-with-Solana message format within sign_message, and rejecting it/issuing a warning.
- Using this flow doesn't provide "simulation" information to the user (dapp could run simulation, but cannot be forced to), so user has less information about what is being signed.
  For that, direct wallet support would be needed.
- Without simulation, entry function is places inside the message, to help user understand better what it is authorizing. This is a balance between given user too much information
  (so it doesn't review it closely), like full json representation of the Aptos transaction, and having users sign without much information. It is a question if adding arguments to the entry    function within the message itself is useful, they can give more context, but can also be quite large and hardly understandable.
- Note that actual address of the module where entry function is will be printed, while a lot UIs (explorer, wallet, etc) might maintain list of common ecosystem projects and addresses,
  and give users more easily understandable name. In order to do so here, we would need to maintain such list onchain, so there are tradeoffs to be considered.

## Future Potential

- `SIWSAbstractSignature` is enum, so that we can support new message formats in the future. 
  For example, we could add list of permissions from AIP-103 to be listed, giving a restricted access to the transaction itself
  - it also allow us, in case a security issue is found, to deprecate current message format while keeping access to the account 

## Timeline

### Suggested implementation timeline

Implemented.

### Suggested developer platform support timeline

Being worked on.

### Suggested deployment timeline

Expected to go into 1.29 or 1.30, and be enabled after extensive testing.
