---
aip: (this is determined by the AIP Manager, leave it empty when drafting)
title: Encrypted Mempool
author: Rex Fernando (rex.fernando@aptoslabs.com)
discussions-to (*optional): <a url pointing to the official discussion thread>
Status: Draft
last-call-end-date (*optional): <mm/dd/yyyy the last date to leave feedbacks and reviews>
type: <Standard (Core, Networking, Interface, Application, Framework) | Informational | Process>
created: 01/09/2026
updated (*optional): <mm/dd/yyyy>
requires (*optional): <AIP number(s)>
---

# AIP-X - Encrypted Mempool
  

## Summary

When a user submits a transaction, it is added to a list of pending
transactions maintained by the validators, commonly called the "mempool",
from which the validators choose transactions to build the next block.
These transactions are public to all validators; this means that the block
leader may choose to order or censor these transactions based on their
behavior in a way that is most profitable for them. This phenomenon is
known as MEV; it has been widely documented and studied in the past several
years, and more adversarial forms of MEV such as sandwich attacks are
recognized as a major problem for on-chain trading.

This AIP describes a new system to protect users on the Aptos network from
harmful forms of MEV (i.e., frontrunning/sandwich attacks, censorship) by
allowing them the option to submit to an encrypted mempool. Specifically:

* Using this option means that the transaction's payload will be encrypted
  client-side before submission, and that the block leader will order these
  transactions while being completely blind to their payloads. 
* The transactions will only be decrypted after consensus on the block's
  contents is finished, just before execution. 
* This decryption will happen directly on the validators via a threshold
  stake-weight vote, meaning that the system introduces no additional trust
  assumptions beyond those under which the network already operates.

Previously, performing threshold decryption on the validators would
have been prohibitively expensive in terms of both communication and
computation, requiring `O(stake weight threshold)` communication per
encrypted payload. This proposal avoids a similar blowup via a new _batch
threshold encryption scheme_. Using this scheme, along with heavy
pipelining, means that the encrypted mempool will support >1000 TPS, with
minimal latency overhead for the network.

### Out of scope

The goal of the first version of this system is to hide transaction
_payloads_. Hiding the transaction _sender and other metadata_ is
currently out-of-scope.

This AIP aims to give a high-level overview of the system. There are
several new cryptographic schemes which were built as part of this effort,
including a new batch threshold encryption scheme, a new ZK range proof,
and a new PVSS scheme. A formal description of the cryptography of these
schemes is out-of-scope for this AIP.

## High-level Overview

 > Define the straw man solution with enough details to make it clear why this is the preferred solution.
 > Please write a 2-3 paragraph high-level overview here and defer writing a more detailed description in [the specification section](#specification-and-implementation-details).

The encrypted mempool comprises the following components:

**A new batch threshold encryption scheme.** The scheme allows validators
to perform a single threshold reconstruction of constant size per block,
regardless of the number of encrypted pending transactions confirmed. It
also allows for much of the computation required for decryption to be
pipelined off the critical path.
  
**A new distributed key generation (DKG) protocol,** which the validators
will run to generate a new encryption key for each epoch, and for which
transaction payloads will be encrypted. This DKG makes use of a new
publicly-verifiable secret sharing scheme (PVSS) designed for the system.

**Integration into consensus.** During consensus, the validators will send
additional messages in order to enable decryption of the payloads which
were included in the block. 

**Modification of the fullnode API to support receiving transactions with
encrypted payloads.** We add a new transaction payload variant which
represents encrypted payloads throughout their lifecycle (encrypted,
successful decryption, decryption failure).

**Modification of the SDK to support sending encrypted transaction
payloads.** The SDK will handle fetching the current encryption key,
generating the payload ciphertext, and submitting the transaction with this
encrypted payload.

**A trusted setup ceremony.** The batch threshold encryption scheme
requires running a one-time trusted setup ceremony, which each validator
must store and use during decryption. 

## Impact

 > Which audiences are impacted by this change? What type of action does the audience need to take?
 > What might occur if we do not accept this proposal?
 > List out other AIPs this AIP is dependent on
  
  

- Audience: traders on Aptos network, interacting with Decibel and w/ any
  other DEX on-chain
- If we do not accept: users will have no protection from frontrunning.

## Alternative Solutions

 > Explain why you submitted this proposal specifically over alternative solutions. Why is this the best possible outcome?

Many alternatives for encrypted mempool:
- naive threshold decryption: communication inefficient, conservative
  estimate is at least 5x more computation on critical path
  - Could offload to an external service. This would introduce additional
    trust assumptions. We want to avoid introducing any trust assumptions,
    so our system must run directly on our validators
- naive IBE: does not provide correct security guarantees
- BEAT-MEV: avenues for censorship

## Specification and Implementation Details

 > How will we solve the problem? Describe in detail precisely how this proposal should be implemented. Include proposed design principles that should be followed in implementing this feature. Make the proposal specific enough to allow others to build upon it and perhaps even derive competing implementations.

- Write out batch threshold encryption interface spec (essentially what's
  in the trait)
- txn format spec
- PVSS spec? (show how it connects to batch threshold encryption)
- trusted setup: file plan, ceremony

## Reference Implementation

 > This is an optional yet highly encouraged section where you may include an example of what you are seeking in this proposal. This can be in the form of code, diagrams, or even plain text. Ideally, we have a link to a living repository of code exemplifying the standard, or, for simpler cases, inline code.
 > What is the feature flag(s)? If there is no feature flag, how will this be enabled?

Point to all PRs

## Testing 

 > - What is the testing plan? (other than load testing, all tests should be part of the implementation details and won’t need to be called out. Some examples include user stories, network health metrics, system metrics, E2E tests, unit tests, etc.) 
 > - When can we expect the results?
 > - What are the test results and are they what we expected? If not, explain the gap.

e2e benchmark results

## Risks and Drawbacks

 > - Express here the potential risks of taking on this proposal. What are the hazards? What can go wrong?
 > - Can this proposal impact backward compatibility?
 > - What is the mitigation plan for each risk or drawback?

Risks are discussed in the next section.

## Security, Liveness, and Privacy Considerations

 > - How can this AIP potentially impact the security of the network and its users? How is this impact mitigated?
 > - Are there specific parts of the code that could introduce a security issue if not implemented properly?
 > - Link tests (e.g. unit, end-to-end, property, fuzz) in the reference implementation that validate both expected and unexpected behavior of this proposal
 > - Include any security-relevant documentation related to this proposal (e.g. protocols or cryptography specifications)

failed decryption could potentially halt the chain
- describe how we implement in a way that prevents this from happening

Simulation of encrypted txns is harder
- trusted simulation-only nodes, run by foundation

Max possible TPS is lower than unencrypted txn max TPS
- We are making this feature optional. So max chain TPS will be unaffected

Has effect on e2e latency of chain
- but net effect should be <10 milliseconds. And we can skip decryption if
  no encrypted txns are in a block, so blocks that don't use this feature
  will have no effect

## Future Potential

 > Think through the evolution of this proposal well into the future. How do you see this playing out? What would this proposal result in one year? In five years?

- potentially could support more general-purpose on-chain decryption.

## Timeline

### Suggested implementation timeline

 > Describe how long you expect the implementation effort to take, perhaps splitting it up into stages or milestones.


### Suggested developer platform support timeline

 > **Optional:** Describe the plan to have SDK, API, CLI, Indexer support for this feature, if applicable. 

sdk design

### Suggested deployment timeline

 > **Optional:** Indicate a future release version as a *rough* estimate for when the community should expect to see this deployed on our three networks (e.g., release 1.7).
 > You are responsible for updating this AIP with a better estimate, if any, after the AIP passes the gatekeeper’s design review.
 >
 > - On devnet?
 > - On testnet?
 > - On mainnet?

- devnet: end of jan/early feb?
- mainnet??

...


## Open Questions (Optional)

 > Q&A here, some of them can have answers some of those questions can be things we have not figured out, but we should

- future plans: hide sender?

...
