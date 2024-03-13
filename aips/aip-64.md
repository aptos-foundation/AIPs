---
aip: 64
title: Validator Transaction Type
author: zhoujun@aptoslabs.com, daniel@aptoslabs.com
discussions-to (*optional): https://github.com/aptos-foundation/AIPs/issues/327
Status: Accepted
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
- For [keyless accounts](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-61.md), the latest JWKs of every OIDC provider are part of the feature configuration, and must be replicated on-chain as soon as possible.
  This is done by a sub-feature [JWK consensus](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-67.md) where the validator transaction framework is used to publish a quorum-certified JWK update on chain.

## Impact

The new transaction type may break downstream consumers (e.g., indexers, explorers, SDKs) if they do not handle unknown transaction types properly.

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

### Node Transaction API changes

Node transaction API should support `ValidatorTransaction` as a new transaction variant.
```rust
/// In aptos_api_types::transaction
pub enum Transaction {
    PendingTransaction(PendingTransaction),
    UserTransaction(Box<UserTransaction>),
    GenesisTransaction(GenesisTransaction),
    BlockMetadataTransaction(BlockMetadataTransaction),
    StateCheckpointTransaction(StateCheckpointTransaction),
    ValidatorTransaction(ValidatorTransaction), // New!
}
```

The following properties of a `ValidatorTransaction` should be exposed.
```rust
/// In aptos_api_types::transaction
pub struct ValidatorTransaction {
    pub info: TransactionInfo,
    pub events: Vec<Event>,
    pub timestamp: U64,
}
```

Example JSON returned from node transaction API `/v1/transactions/by_version/<version>`:
```json
{
  "version": "19403939",
  "hash": "0x8853505309d4f5b97a6ac3004f2410df055cdd507c99fce3e0318f7deeef43ff",
  "state_change_hash": "0x4a70ca32dfb51227fca6c7d430f49cc9e822e96b1ffcff8b4d8fd2ae3ae53ecb",
  "event_root_hash": "0xc49747cf5fa2dcb6351a7039a6604b63d73d6f4de3e2e14bee88f8ff5f346229",
  "state_checkpoint_hash": "0x9e67939845db211fb5596733391bbdeda0dcbf4d2bf7fe72496cab6eef23daff",
  "gas_used": "0",
  "success": true,
  "vm_status": "Executed successfully",
  "accumulator_root_hash": "0x50d548f5f7a73f3e2d1bc62a91abca9fead3bcec3dc590793521f21f2092d143",
  "changes": [
    {
      "address": "0x1",
      "state_key_hash": "0x2287692c179002981a8fe19f6def197ed5ff452848659e2e091ead318d719050",
      "data": {
        "type": "0x1::reconfiguration::Configuration",
        "data": {
          "epoch": "5098",
          "events": {
            "counter": "5098",
            "guid": {
              "id": {
                "addr": "0x1",
                "creation_num": "2"
              }
            }
          },
          "last_reconfiguration_time": "1709688193025121"
        }
      },
      "type": "write_resource"
    },
  ],
  "events": [
    {
      "guid": {
        "creation_number": "2",
        "account_address": "0x1"
      },
      "sequence_number": "5097",
      "type": "0x1::reconfiguration::NewEpochEvent",
      "data": {
        "epoch": "5098"
      }
    }
  ],
  "timestamp": "1709688193025121",
  "type": "validator_transaction"
}
```

Note that the current API specification is opaque about the upper-level feature that triggers this transaction.
Here are the reasons to do so.
- This way, we can avoid changing transaction API specification each time a new feature that requires validator transactions is added.
- It is unclear who is interested in knowing the upper-level feature of a validator transaction.
  (Since validator transactions are not public-facing, it makes sense to not expose them at all.
  But currently it is not an option.)
- In practice, fields `changes` and `events` are enough to determine the upper-level feature:
  each feature typically has its unique events to emit/resources to touch.

### Internal data format changes (for validator network/storage)

The internal `Transaction` enum used by validator network/storage also has to support a new variant.
```rust
/// In aptos_types::transaction
pub enum Transaction {
    UserTransaction(SignedTransaction),
    GenesisTransaction(WriteSetPayload),
    BlockMetadata(BlockMetadata),
    StateCheckpoint(HashValue),
    ValidatorTransaction(ValidatorTransaction), // New!
}
```

Updating the internal data format is less pain than updating API specification,
so here the `ValidatorTransaction` is explicit about its upper-level feature.
```rust
/// In aptos_types::validator_txn
pub enum ValidatorTransaction {
    DKGResult(DKGTranscript),
    ObservedJWKUpdate(jwks::QuorumCertifiedUpdate),
    // future features...
}
```

For the validators to propose validator transactions in Joteon consensus,
a proper `Proposal` extension (i.e., `ProposalExt`) is also required.
```rust
/// In aptos_consensus_types::proposal_ext
pub enum ProposalExt {
    V0 {
        validator_txns: Vec<ValidatorTransaction>, // the old `Proposal` doesn't have this
        payload: Payload,
        author: Author,
        failed_authors: Vec<(Round, Author)>,
    },
}
```

### High-level Data Flow in Validator

At a high level, participating processes are the follows.
- Upper-level feature processes as the validator transaction producers.
- Consensus as the validator transaction consumers.
- A validator transaction pool to decouple the producers and the consumer.
  - Transactions can be maintained in a queue for fairness.

Below are the key interactions.
- Producers put validator transactions into the pool.
- When the consensus needs to propose, it should pull some validator transactions from the pool first.
  - A pull limit on the count and size needs to be agreed on.
- When the consensus receives a proposal, it should verify that the proposed validator transactions do not exceed the pull limit.
- Producers may changes its mind of what transaction to propose, or at the end of the epoch, help clean up the pool.
  - This requires the pool to support "revoke" operation.

### Execution

It is up to each individual feature to define what its validator transactions should do, how it should be verified in proposal and in execution.

The definition needs to include the security practice discussed in section [Security Considerations](#security-considerations).

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
