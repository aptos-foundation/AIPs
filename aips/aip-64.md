---
aip: 64
title: Validator Transaction Type
author: zhoujun@aptoslabs.com, daniel@aptoslabs.com
discussions-to (*optional): <a url pointing to the official discussion thread>
Status: <Draft | Last Call | Accepted | Final | Rejected>
last-call-end-date (*optional): <mm/dd/yyyy the last date to leave feedbacks and reviews>
type: Standard (Core/Framework)
created: <10/17/2023>
updated (*optional): <mm/dd/yyyy>
requires (*optional): <AIP number(s)>
---

# AIP-64 - Validator Transaction Type

## Summary

The Aptos blockchain, as it currently stands, predominantly handles two kinds of transactions: `UserTransaction` and a pair of specific validator transactions (`BlockMetadata` and `StateCheckpoint`). Looking ahead, there is a clear need for the integration of additional types of validator transactions to support future applications. In response to this requirement, this AIP proposes the introduction of a 'validator transaction type'. This type will be structured as an enumeration (enum), facilitating the straightforward expansion and incorporation of various distinct validator transaction instances in the future.

### Goals

The objectives of this AIP are twofold:
- Introduce a new transaction type, referred to as `ValidatorTransaction`.
- To implement any requisite modifications ensuring compatibility with the introduction of `ValidatorTransaction`.

### Out of Scope

The specific details regarding future extensions of validator transaction instances are beyond the scope of this document. These details will be proposed and implemented by future developers as the need arises.

## Motivation

Future applications necessitate the blockchain's ability to efficiently agree upon and update specific proposals on-chain. Validator transactions facilitate this process by enabling validators to swiftly propose changes and reach consensus in just a few seconds, a feat made possible by the low latency of the Aptos blockchain. In the absence of validator transactions, reaching such an agreement would be dependent on [Aptos Governance](https://aptos.dev/concepts/governance/), a more time-consuming process that not only spans several days or even weeks but also requires manual proposal submissions each time.

A typical usage of the validator transaction framework is for validators to update the on-chain configurations for **another feature** with minimum latency.
Some Aptos features have adopt it as a building block.
- In [on-chain randomness](https://github.com/aptos-foundation/AIPs/pull/321/files) design, randomness generation key shares for epoch `e` validators are on-chain configurations.
  They are computed off-chain at the end of epoch `e-1` and then published on chain using a `ValidatorTransaction`.
- For [OIDB accounts](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-61.md), the latest JWKs of every OIDC provider are part of the feature configuration, and must be replicated on-chain as soon as possible.
  This is done by a sub-feature [JWK consensus](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-67.md) where the validator transaction framework is used to publish a quorum-certified JWK update on chain.

## Impact

This AIP will benefit blockchain-core developers by providing them the flexibility to enhance the blockchain system with new varieties of validator transactions. Additionally, it may influence downstream infrastructure elements, like Indexers and SDKs, necessitating potential adjustments to maintain compatibility.

`ValidatorTransaction` needsd to be a new transaction type.
Downstream consumers (e.g., indexers, explorers, SDKs) may be broken if they do not handle unknown transaction types properly.

## Alternative solutions

An alternative approach involves repeatedly executing similar functions through [Aptos Governance](https://aptos.dev/concepts/governance/), a process that could span several days or weeks. However, this method is impractical for numerous applications that require efficiency.

For the purpose of publishing on-chain configuration updates, there are some other alternatives.
One is to publish updates in the existing *BlockMetadata transactions*.
While it saves the trouble of adding a new transaction type, there are some long-term problems as more features pick up this method:
- `BlockMetadata` transactions are more critical and need to be formally verified to never abort.
  Publishing the feature-specific updates in  `BlockMetadata` transactions requires the updates to be formally verified, which is unnecessary.
- Running all updates sequentially in a single `BlockMetadata` transactions can be too slow.
  As mentioned in [security considerations](#security_considerations), every update needs to be cryptographically verified which can be expensive operations.
  Pulling updates out into separate transations helps speed up the execution.

A 2nd alternative is to propose the updates as user transactions.
But notice that:
- These updates are for system configurations and typically requires higher priority than user transactions.
- Unlike user transactions, there is no gas involved in these updates.
- The execution result of such updates needs different handling from user transactions. (See [security considerations](#security_considerations).)

Therefore, while the 2nd alternative also avoids a new transaction type,
it will also complicate the existing user transaction flow.
Creating a separate flow for the updates should provide better maintainability.

## Specification

The validator transaction type will be introduced as the following:
```
pub enum ValidatorTransaction {
    DummyTopic(DummyValidatorTransaction),
    // to be populated...
}
```
which can be extended with any concrete validator transaction instance in the future. 
For instance, a dummy validator transaction instance can be:
```
pub struct DummyValidatorTransaction {
    pub nonce: u64,
}
```
For the validators to propose validator transactions, a proper `Proposal` extension (i.e., `ProposalExt`) is also required:
```
pub enum ProposalExt {
    V0 {
        /// The list of validator transactions contained in the block proposal
        validator_txns: Vec<ValidatorTransaction>,
        /// T of the block (e.g. one or more transaction(s)
        payload: Payload,
        /// Author of the block that can be validated by the author's public key and the signature
        author: Author,
        /// Failed authors from the parent's block to this block.
        /// I.e. the list of consecutive proposers from the
        /// immediately preceeding rounds that didn't produce a successful block.
        failed_authors: Vec<(Round, Author)>,
    },
}
```

## Reference Implementation

https://github.com/aptos-labs/aptos-core/pull/10963

https://github.com/aptos-labs/aptos-core/pull/10971

## Testing (Optional)

This AIP, focusing solely on formatting changes without introducing new concrete validator transaction types, necessitates ensuring compatibility through existing tests. However, it's important to note that any future extensions of the validator transaction types will require comprehensive testing to maintain system integrity and functionality.

## Risks and Drawbacks

The introduction of the validator transaction type raises the possibility of malicious blockchain-core developers damaging the blockchain system by proposing harmful validator transaction extensions. Therefore, it is crucial that any future additions of new validator transaction types be accompanied by a separate AIP and undergo thorough and careful review to mitigate such risks.


## Future Potential

This AIP holds the potential to enable a variety of use cases that require the blockchain to efficiently and periodically reach consensus on proposals.

## Timeline

### Suggested deployment timeline

The suggested timeline for this AIP is release 1.10.

## Security Considerations

Nothing prevents a malicious validator from proposing invalid validator transactions. Therefore, the validator transaction framework needs to be implemented securely to mitigate the negative impacts.
- The number and the total size of validator transactions in a block should be limited.
  ([reference implementation](https://github.com/aptos-labs/aptos-core/blob/d4fdb8f08929903044673d03e79c9f118a6c714a/consensus/src/payload_client/mixed.rs#L82-L96))
- If feature X is disabled, validator transactions for feature X should be unexpected in block proposals.
  ([example implementation](https://github.com/aptos-labs/aptos-core/blob/7b2b2332f1f865b1ec367601045b2e0cd836a15d/consensus/src/round_manager.rs#L665-L673))
- The update embedded in any validator transaction should be quorum-certifiable.
    - Execution of any validator transaction should involve verification of the quorum-cert.
      ([example implementation](https://github.com/aptos-labs/aptos-core/blob/d4fdb8f08929903044673d03e79c9f118a6c714a/aptos-move/aptos-vm/src/validator_txns/jwk.rs#L119-L127))
    - Verification failure should result in the validator transaction to be discarded.
      ([example implementation](https://github.com/aptos-labs/aptos-core/blob/d4fdb8f08929903044673d03e79c9f118a6c714a/aptos-move/aptos-vm/src/validator_txns/jwk.rs#L68-L75))
