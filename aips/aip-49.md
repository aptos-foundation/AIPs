---
aip: 49
title: secp256k1 ECDSA for Transaction Authentication
author: davidiw
discussions-to (*optional): https://github.com/aptos-foundation/AIPs/issues/247
Status: Draft
last-call-end-date (*optional): <mm/dd/yyyy the last date to leave feedbacks and reviews>
type: Interface
created: 09/28/2023
updated (*optional): <mm/dd/yyyy>
---

# AIP-49 - Secp256k1 ECDSA for Transaction Authentication
  
Despite our desire to see more diverse key algorithms supported in hardware cryptographic platforms, the primary Aptos key algorithm, Ed25519, has yet to be adopted broadly across the ecosystem. `secp256k1` ECDSA remains the incumbent and is broadly supported. This AIP introduces support `secp256k1` ECDSA as a transaction authenticator for Aptos.

## Summary

In Aptos, each transaction contains a transaction authenticator that includes a signature and a public key, while the transaction itself contains the sender of the transaction. To verify that a transaction is properly signed, the verifier validates that the public key verifies the signature across the transaction and that the hash of the public key is stored on-chain in a hashed form under the account. By completing this verification, the verifier can be certain that the owner of the account indeed authorizes this transaction. This AIP adds support for `secp256k1` ECDSA for transaction authentication.

## Motivation

* Many organizations already have support for `secp256k1` ECDSA but not Ed25519
* Hardware crypto has not broadly adopted Ed25519 yet remain compatible with `secp256k1` ECDSA

## Specification

While most of this is a straighforward application of `secp256k1` ECDSA, the following are distinct aspects as related to Aptos:

* All signatures are normalized, that is s is set to be low order.
* Signatures that are not normalized are rejected.
* As `secp256k1` ECDSA signs and verifies 32-byte messages. Our framework produces a 32-byte message digests by applying Sha3-256 to the message.

## Reference Implementation

https://github.com/aptos-labs/aptos-core/pull/10207

## Testing

This has been fully implemented and verified in end-to-end tests.

## Timeline

### Suggested implementation timeline

Completely implemented, pending any external feedback.


### Suggested developer platform support timeline

* API support has been verified
* Indexer code has been updated and waiting verification in devnet
* SDK will be updated shortly

### Suggested deployment timeline

Available for devnet by early October with intention of being released in 1.8.
