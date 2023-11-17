---
aip: (this is determined by the AIP Manager, leave it empty when drafting)
title: System Transaction Type
author: zhoujun@aptoslabs.com, daniel@aptoslabs.com
discussions-to (*optional): <a url pointing to the official discussion thread>
Status: <Draft | Last Call | Accepted | Final | Rejected>
last-call-end-date (*optional): <mm/dd/yyyy the last date to leave feedbacks and reviews>
type: Standard (Core/Framework)
created: <10/17/2023>
updated (*optional): <mm/dd/yyyy>
requires (*optional): <AIP number(s)>
---

# AIP-X - System Transaction Type

## Summary

The Aptos blockchain, as it currently stands, predominantly handles two kinds of transactions: `UserTransaction` and a pair of specific system transactions (`BlockMetadata` and `StateCheckpoint`). Looking ahead, there is a clear need for the integration of additional types of system transactions to support future applications. In response to this requirement, this AIP proposes the introduction of a 'system transaction type'. This type will be structured as an enumeration (enum), facilitating the straightforward expansion and incorporation of various distinct system transaction instances in the future.

### Goals

The objectives of this AIP are twofold:
- Introduce a new transaction type, referred to as `SystemTransaction`.
- To implement any requisite modifications ensuring compatibility with the introduction of `SystemTransaction`.

### Out of Scope

The specific details regarding future extensions of system transaction instances are beyond the scope of this document. These details will be proposed and implemented by future developers as the need arises.

## Motivation

Future applications necessitate the blockchain's ability to efficiently agree upon and update specific proposals on-chain. System transactions facilitate this process by enabling validators to swiftly propose changes and reach consensus in just a few seconds, a feat made possible by the low latency of the Aptos blockchain. In the absence of system transactions, reaching such an agreement would be dependent on [Aptos Governance](https://aptos.dev/concepts/governance/), a more time-consuming process that not only spans several days or even weeks but also requires manual proposal submissions each time.


## Impact

This AIP will benefit blockchain-core developers by providing them the flexibility to enhance the blockchain system with new varieties of system transactions. Additionally, it may influence downstream infrastructure elements, like Indexers and SDKs, necessitating potential adjustments to maintain compatibility.

## Alternative solutions

An alternative approach involves repeatedly executing similar functions through [Aptos Governance](https://aptos.dev/concepts/governance/), a process that could span several days or weeks. However, this method is impractical for numerous applications that require efficiency.

## Specification

The system transaction type will be introduced as the following:
```
pub enum SystemTransaction {
    DummyTopic(DummySystemTransaction),
    // to be populated...
}
```
which can be extended with any concrete system transaction instance in the future. 
For instance, a dummy system transaction instance can be:
```
pub struct DummySystemTransaction {
    pub nonce: u64,
}
```
For the validators to propose system transactions, a proper `Proposal` extension (i.e., `ProposalExt`) is also required:
```
pub enum ProposalExt {
    V0 {
        /// The list of system transactions contained in the block proposal
        system_txns: Vec<SystemTransaction>,
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

This AIP, focusing solely on formatting changes without introducing new concrete system transaction types, necessitates ensuring compatibility through existing tests. However, it's important to note that any future extensions of the system transaction types will require comprehensive testing to maintain system integrity and functionality.

## Risks and Drawbacks

The introduction of the system transaction type raises the possibility of malicious blockchain-core developers damaging the blockchain system by proposing harmful system transaction extensions. Therefore, it is crucial that any future additions of new system transaction types be accompanied by a separate AIP and undergo thorough and careful review to mitigate such risks.


## Future Potential

This AIP holds the potential to enable a variety of use cases that require the blockchain to efficiently and periodically reach consensus on proposals.

## Timeline

### Suggested deployment timeline

The suggested timeline for this AIP is release 1.9.
