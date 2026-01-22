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

**Modification of the SDK and wallet standard to support sending encrypted
transaction payloads.** Both the SDK and wallets supporting the feature
will be modified for allowing submission of transactions with
encrypted payloads. To do this, they will handle fetching the current
encryption key, generating the payload ciphertext, and submitting the
transaction with this encrypted payload. Submission with encrypted payload
will be optional, to be determined by the user.

**A trusted setup ceremony.** The batch threshold encryption scheme
requires running a one-time trusted setup ceremony, which each validator
must store and use during decryption. 

## Impact

 > Which audiences are impacted by this change? What type of action does the audience need to take?
 > What might occur if we do not accept this proposal?
 > List out other AIPs this AIP is dependent on
  
 - Dapp developers
   - Familiarize themselves with the SDK modifications.
 - Wallet developers
   - If they choose to support sending transactions to the encrypted
     mempool natively from their wallet, implement the new wallet standard
     feature.
- Audience: traders on Aptos network, interacting with Decibel and with any
  other DEX on-chain.
- If we do not accept this AIP: users will have no protection from frontrunning.

## Alternative Solutions

 > Explain why you submitted this proposal specifically over alternative solutions. Why is this the best possible outcome?

**Classical threshold encryption.** Using a classical threshold encryption
scheme would mean that for every encrypted pending transaction included in
a block, the keyshare holders (in our case, the validators) would be
required to perform a threshold decryption protocol. This means
(1) generating and broadcasting a partial decryption per transaction, and (2) after
receiving a stake-weight threshold of partial decryptions for that
transaction, combining them to reconstruct the plaintext payload. This
would cause prohibitively large computation and communication overheads for
the validators. 

One option for dealing with this cost is to offload it from the validators,
and to trust some other committee of parties for decryption of transactions that
make it into each block. But this would introduce a completely new trust
assumption to the system in the form of this committee. A major goal of our
system is to avoid introducing new trust assumptions. In addition to this,
it seems difficult to instantiate this idea in a way that avoids a large
latency overhead for encrypted pending transactions. The most natural way
would be to have a contract on-chain that keeps a queue of confirmed encrypted
pending transactions, and to have the committee decrypt transactions as
soon as they reach this queue. But this would mean that these transactions
would wait several rounds after they are confirmed in order to be executed.

**Identity-based encryption (IBE).** IBE allows for encrypting with respect
to an arbitrary tag, called an ID, along with a master public key. The
corresponding master secret key holder (or a threshold of keyshare holders)
can generate a decryption key, also with respect to an ID, that decrypts
all ciphertexts encrypted to that ID. Setting the ID to be block height,
one could attempt to use this to build an encrypted mempool with a single
threshold reconstruction per block: during consensus, the validators
reconstruct a decryption key with ID equal to the current block's height,
which can decrypt all encrypted payloads submitted with respect to that
height. Unfortunately, this fails to provide a meaningful notion of
security. This is because any encrypted transaction which _targets_ a specific
block is completely revealed, even _if it fails to be included in the
block_, for instance because of congestion, or because the fullnode decides
to censor it.

**Previous batch threshold encryption schemes.** Several previous works [cite]
(including one by our team) study batch threshold encryption. Although they
solve the problems discussed above, all previous works either have
user-experience issues related to transaction resubmission, are
computationally expensive, or have problems related to denial-of-service
(or some combination of the three).

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
