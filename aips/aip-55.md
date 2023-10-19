---
aip: 55
title: Generalize Transaction Authentication and Support Arbitrary K-of-N MultiKey Accounts
author: davidiw, hariria
discussions-to:
Status: Draft
last-call-end-date (*optional): <mm/dd/yyyy the last date to leave feedbacks and reviews>
type: Platform
created: 10/16/2023
updated (*optional): <mm/dd/yyyy>
requires (*optional): N/A
---

# AIP-55 - Generalize Transaction Authentication and Support Arbitrary K-of-N MultiKey Accounts

## Summary

Transactions submitted to Aptos contain a `RawTransaction` and a `TransactionAuthenticator`. The `TransactionAuthenticator` authorizes the execution of the transaction by the set of senders or approvers of the accounts within the transaction. The `TransactionAuthenticator` contains a mixture of general purpose authenticators called `AccountAuthenticators` for us in fee payer and multiagent as well as also some very specific types for single sender transactions such as Ed25519, MultiEd25519, and Secp256k1. Thus adding a new cryptographic proof for authorizing a transaction requires a new `TransactionAuthenticator`, `AccountAuthenticator`, and specialized cryptographic authenticators.

Beyond this concern, Aptos only supports a single multi-key scheme, ed25519. Multi-key schemes provide value when users can leverage different proof types for different purposes, such as leveraging Ed25519 for their wallet and a Secp256k1 from HSMs for account recovery. New technologies like Passkeys and OAuth login systems may require additional cryptographic algorithms. Combining these disparate technologies together improves user experience around managing a single account from a plethora of devices, platforms, and environments.

This AIP introduces a new `TransactionAuthenticator` called `SingleSender` that supports two `AccountAuthenticator`s, SingleKeyAuthenticator and MultiKeyAuthenticator, which supports a single key and a k-of-n multi-key, respectively. These authenticators decouple the proof type from both the `TransactionAuthenticator` and `AccountAuthenticator` simplifying the addition of new cryptographic proofs for account authentication.

### Goals

* Eliminate duplication of code across `TransactionAuthenticator`, `AccountAuthenticator`, and `AuthencticationKey` by providing a single means to represent the identity therein.
* Make adding new cryptographic protocols consistent across multi-sender and single-sender transactions. Current single-sender transactions expect a specific type of cryptographic algorithm in the `TransactionAuthenticator` where as multi-sender transactions expect them in the `AccountAuthenticator`.
* Deliver a unified framework for MultiKey authentication that works across both single and multi-sender transactions.

## Alternative solutions

This work could have focused purely on multi-key solutions that work across the board. This would have eliminated the optimization for single-sender applications. Doing so increases the burden for adding cryptographic algorithms for authorization.

Instead of doing this at an account level, we could have used Multisigv2. In Multisigv2, multiple on-chain accounts share a single account. This is similar to the model here, where multiple keys share the same account. The caveat being that if keys are misplaced in a Multisigv2, the assets within those accounts are lost. Those accounts require minimally gas fees, so there would be inevitable loss.

## Specification

### Data Structures

```
TransactionAuthenticator::SingleSender { sender: AccountAuthenticator }
AccountAuthenticator::SingleKey { authenticator: SingleKeyAuthenticator }
AccountAuthenticator::MultiKey { authenticator: MultiKeyAuthenticator }

pub struct SingleKeyAuthenticator {
    public_key: AnyPublicKey,
    signature: AnySignature,
}

pub struct MultiKeyAuthenticator {
    public_keys: MultiKey,
    signatures: Vec<AnySignature>,
    signatures_bitmap: aptos_bitvec::BitVec,
}

pub enum AnySignature {
    Ed25519 {
        signature: Ed25519Signature,
    },
    Secp256k1Ecdsa {
        signature: secp256k1_ecdsa::Signature,
    },
}

pub enum AnyPublicKey {
    Ed25519 {
        public_key: Ed25519PublicKey,
    },
    Secp256k1Ecdsa {
        public_key: secp256k1_ecdsa::PublicKey,
    },
}

pub struct MultiKey {
    public_keys: Vec<AnyPublicKey>,
    signatures_required: u8,
}
```

### Logic

The `TransactionAuthenticator` now contains a `SingleSender` variant. The `SingleSender` variant supports any `AccountAuthenticator`. The `AccountAuthenticator` now supports two new variants `SingleKey` and `MultiKey` that support a single or multiple arbitrary key types, respectively. Supported key types are defined within the `AnyPublicKey` and `AnySignature` enums. New cryptographic algorithms can be added by updating `AnyPublicKey` and `AnySignature`.

The `AccountAuthenticator::MultiKey` contains `MultiKeyAuthenticator` supports up to 255 keys and up to 32 signatures. The 255 keys is enforced by checks on the length of `MultiKey::public_keys` and `signatures_bitmap` length. The choice of 32 signatures is a system-wide limitation imposed by Aptos, which enforces that no transaction can contain more than 32 signatures. This AIP simply conforms to that standard.

The `MultiKey` structure is effectively the public key for the account. The `MultiKey::signatures_required` field dictates how many valid signatures must be contained therein for the signature to be fully authenticated.

The `MultiKeyAuthenticator::signatures` contains a set of signatures order in the same order as the `1`s defined in the `MultiKeyAuthenticator::signatures_bitmap`. Making it convenient to use a zip operation across the two to produce a tuple of `(index, signature)`, where the `index` is the `AnyPublicKey` stored in that position within the `MultiKeyAuthenticator::public_keys`.

### Address and Authentication Key Derivation

In Aptos, account addresses and authentication keys are derived from the hash of a public key associated with an account and a scheme or integer associated with the key algorithm of the public key. The scheme offers a unique postfix to ensure that two distinct key algorithms cannot result in the same address ownership and mitigating cases where a malicious user could gain access to a victim account.

Authentication keys are a hash representation of the set of public keys that authorize execution of transaction for an account. While the account address is derived from the account's initial authentication key, Aptos enables account key rotation by the decoupling of these values. Specifically, the authentication key is updated to the hash of a new public key, while the address remains unchanged.

This AIP introduces both `SingleKey` and `MultiKey` containers for public keys and thus derivation of authentication keys. The scheme for `SingleKey` and `MultiKey` are 2 and 3, respectively.

The authentication key for a Secp256k1 Ecdsa key can be computed by performing the following operation: `sha3_256(1 as u8 | 65 bytes of Secp256k1 Ecdsa Public Key | 2 as u8)`

The first integer, 1, is taken from the `Secp256k1Ecdsa` position in the `AnyPublicKey` struct. The second integer, 2, is taken from the `SingleKey` value within the `Scheme` enum. This derives directly from how BCS implements serialization.

## Reference Implementation

https://github.com/aptos-labs/aptos-core/pull/10519

## Testing

Verified thoroughly with integration tests and an end-to-end test for the Secp256k1 Ecdsa single key variant.

## Risks and Drawbacks

This does increase the number of ways a key can be used, which in turn makes it possible that the same private key can be used across distinct accounts. This, however, already existed as a result of MultiEd25519.

As one of the goals is to have distinct devices using a common device. This poses problem of how does a new device enumerate all public keys currently contained within a `MultiKey`. The problem also arises for `MultiEd25519` keys and is unaddressed in this AIP.

The existing means of representing every public key in the `TransactionAuthenticator` can result in storage inefficiencies as a single trtansaction of 255 65-byte Secp256k1 Ecdsa keys is over 16KB. This could be made more efficient through Merkle trees or other forms of where only a subset of the data is required for making a proof and the remainder of authenticating completeness. This is currently not explored and can be addressed in updates as the application of these primitive takes shape.

## Security Considerations

There are no obvious security considerations as this largely leverages the same set of features and properties already inherent in the system.

## Timeline

The intended timeline for this AIP is release 1.8.
