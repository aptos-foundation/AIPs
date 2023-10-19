---
aip: X
title: secp256r1 ECDSA for Transaction Authentication
author: mstraka100
discussions-to (*optional): https://github.com/aptos-foundation/AIPs/issues/266
Status: Draft
last-call-end-date (*optional): <mm/dd/yyyy the last date to leave feedbacks and reviews>
type: Interface
created: 10/18/2023
updated (*optional): <mm/dd/yyyy>
---

# AIP-X - Secp256r1 Ecdsa for Transaction Authentication

Passkeys are a novel form of authentication utilizing signing with cryptographic private keys in trusted execution environments, built on the WebAuthn standard, meant to replace passwords. 
They have already been adopted by many large consumer-facing tech companies, such as Apple and Google. 
Passkeys may be useful for a more streamlined way of signing transactions on Aptos.
However, the WebAuthn standard currently supports a limited range of signing algorithms and curves, including ECDSA over `secp256r1`.
This AIP introduces support for `secp256r1` ECDSA as a transaction authenticator for Aptos.

## Summary

In Aptos, each transaction contains a transaction authenticator that includes a signature and a public key, while the transaction itself contains the sender of the transaction. To verify that a transaction is properly signed, the verifier validates that the public key verifies the signature across the transaction and that the hash of the public key is stored on-chain in a hashed form under the account. By completing this verification, the verifier can be certain that the owner of the account indeed authorizes this transaction. This AIP adds support for `secp256r1` ECDSA for transaction authentication.

## Motivation

Passkeys built on the WebAuthn standard supports `secp256r1`. The following OS platforms support ECDSA over `secp256r1`:

* iOS
* MacOS
* Android
* Windows 11

## Specification

While most of this is a straighforward implementation of `secp256r1` ECDSA, the following are distinct aspects as related to Aptos, in order to ensure that every message has only one canonical signature that will be accepted on-chain:

* All signatures are normalized, that is s is set to be low order. If a signature `(r,s)` is generated during signing, the valid signature `(r,n-s)` is returned where `n` is the order of the `secp256r1`scalar field.
* Signatures that are not normalized are rejected. If a signature `(r,s)` is received where `s > (n/2)`, the signature is rejected. 

The above steps are done to prevent malleability attacks. 

## Reference Implementation

https://github.com/aptos-labs/aptos-core/pull/9594

## Testing

This has been fully implemented and verified in end-to-end tests.

## Timeline

### Suggested implementation timeline

Completely implemented, pending any external feedback.

### Suggested developer platform support timeline

* Verify API support
* Update indexer code
* Update SDK

### Suggested deployment timeline

Included for release in 1.8
