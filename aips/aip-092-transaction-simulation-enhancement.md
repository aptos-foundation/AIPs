---
aip: 92
title: Transaction Simulation Enhancement
author: junkil-park (https://github.com/junkil-park), movekevin (https://github.com/movekevin), gregnazario (https://github.com/gregnazario)
discussions-to (*optional): https://github.com/aptos-foundation/AIPs/issues/493
Status: Accepted
last-call-end-date (*optional): <mm/dd/yyyy the last date to leave feedbacks and reviews>
type: Standard (Ecosystem)
created: 6/25/2024
updated (*optional): <mm/dd/yyyy>
requires (*optional): <AIP number(s)>
---

# AIP-92 - Transaction Simulation Enhancement

## Summary

This AIP proposes enhancements to the simulation functionality. The changes aim to improve the flexibility of the simulation by bypassing the authentication key check, eliminating the gas fee payment requirement, and improving the consistency of multisig transaction simulation.

# High-level Overview

This PR enhances the simulation functionality in several key ways:

1. Bypass Authentication Key Check:
   * Removes the mandatory check for an authentication key during simulations.
   * This addresses a long-standing and frequently requested feature in [this issue](https://github.com/aptos-labs/aptos-core/issues/6862).

2. Eliminate Gas Fee Payment Requirement:
   * Removes the requirement for a gas fee payer during simulations when the fee payer address is 0x0.
   * Simulations will no longer validate the presence of sufficient funds for gas payment, allowing developers to test scenarios without considering gas fees.
   * This addresses the feature request in [this issue](https://github.com/aptos-labs/aptos-core/issues/13686)

3. Improve Multisig Simulation Consistency:
   * Merges the Multisig payload simulation path with the execution path, ensuring consistency between simulation and actual execution.
   * This resolves the issue of an onchain payload not being retrived (described [here](https://github.com/aptos-labs/aptos-core/issues/12703) and [here](https://github.com/aptos-labs/aptos-core/issues/8304)).
   * This also resolves the issue of inaccurate gas estimation for multisig transactions (described [here](https://github.com/aptos-labs/aptos-core/issues/12704)).

These changes are aimed at improving the flexibility of the simulation environment, allowing developers to test transactions and interactions without the constraints of authentication keys and gas fee payments. Additionally, the changes enhance the accuracy of multisig transaction simulations, ensuring they are consistent with the actual execution.

## Impact

Smart contract developers will benefit from the enhanced simulation functionality, which provides greater flexibility and covers the existing gaps in simulation. The proposed changes will improve the developer experience.

Currently, the multisig transaction simulation allows for simulating inner payloads without requiring sufficient approvals. This is used to pre-check a multisig payload before it is created on-chain. However, with the changes proposed in this AIP, the multisig simulation can no longer be used for pre-checking the multisig payload. After the changes, the multisig simulation will align with the actual execution process. It will be used for final-checking and gas estimation right before submitting the transaction for execution. To address this, a new method for pre-checking a multisig payload before its creation on-chain will be introduced. This method involves simulating the payload with the multisig account as the sender, bypassing the auth key check and gas fee payment. This will enable the validation of the well-formedness of the multisig payload at the time of creation, thus addressing the issue described  [here](https://github.com/aptos-labs/aptos-core/issues/11106).

## Specification and Implementation Details

1. Bypass Authentication Key Check:
   * We will introduce a new enum variant `NoAccountAuthenticator` to the `AccountAuthenticator`. This variant will represent the absence of an authenticator (i.e., public key and signature) during simulation.
        ```
        pub enum AccountAuthenticator {
            ...
            NoAccountAuthenticator,
            // ... add more schemes here
        }
        ```
   * During the transaction validation process (in the prologue functions in `transaction_validation.move`), we bypass the authentication key check if it's in the simulation mode and the auth key is empty because the authenticator is `NoAccountAuthenticator`.

2. Eliminate Gas Fee Payment Requirement:
    * We remove the gas fee payment requirement during simulations if it's in the simulation mode and the gas payer address is 0x0.
    * We disable the gas deposit feature in the simulation mode by setting the required gas deposit to `None`. In this way, we can bypass the gas fee deposit requirement during simulation.

3. Improve Multisig Simulation Consistency:
    * We merge the Multisig payload simulation path with the execution path to ensure consistency between simulation and actual execution. Other types of payloads (such as entry function / script) already use the same path for simulation and execution, so this change will align the Multisig payload with the existing simulation logic.

## Reference Implementation

https://github.com/aptos-labs/aptos-core/pull/13714

## Testing

The reference implementation includes multiple unit tests and end-to-end tests covering various positive/negative scenarios. These scenarios will be tested on the devnet and testnet.

## Security Considerations

This AIP allows skipping the auth key check and gas fee payment for the simulation. This feature is only available in the simulation and does not affect the actual execution of the transaction on the blockchain.

If a transaction using `NoAccountAuthenticator` is submitted for execution, it will always fail with an `INVALID_SIGNATURE` error, as the authenticator cannot be verified.

## Timeline

### Suggested implementation timeline

The implementation is planned to land on the `main` branch before the branch cut for v1.19.

### Suggested developer platform support timeline

The SDK will be updated to support this feature before it is released on the mainnet.

### Suggested deployment timeline

* On the devnet: with release v1.19
* On the testnet and mainnet: depends on the AIP approval process
