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
[Rex: should I mention Shutter network by name here?]

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
to censor it. [Rex: should I mention fairblock by name here?]

**Previous batch threshold encryption schemes.** Several previous works [cite]
(including one by our team) study batch threshold encryption. Although they
solve the problems discussed above, all previous works either have
user-experience issues related to transaction resubmission, are
computationally expensive, or have problems related to denial-of-service
(or some combination of the three).

## Specification and Implementation Details

 > How will we solve the problem? Describe in detail precisely how this
 > proposal should be implemented. Include proposed design principles that
 > should be followed in implementing this feature. Make the proposal
 > specific enough to allow others to build upon it and perhaps even derive
 > competing implementations.

### Background on Aptos blockchain
 
As described in
[AIP-79](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-79.md#background-on-aptos-blockchain): 

> Aptos is a **proof-of-stake (PoS)** blockchain with a consensus algorithm
> that operates in periodic two-hour intervals known as **epochs**. The set
> of validators and their stake distribution remain fixed within each
> epoch, and can change across epoch boundaries. The validators of the next
> epoch do not come online until the new epoch starts.
>
> The blockchain also decouples **consensus** (i.e., currently a BFT
> consensus protocol named [Jolteon](https://arxiv.org/abs/2106.10362))
> from **execution** (i.e., an optimistic concurrency control execution
> engine
> named [BlockSTM](https://medium.com/aptoslabs/block-stm-how-we-execute-over-160k-transactions-per-second-on-the-aptos-blockchain-3b003657e4ba)),
> where each block is first finalized by consensus and then executed to
> update the blockchain state. This consensus-execution decoupling is
> especially important for on-chain randomness, because it allows the
> network to first commit to an ordering of transactions before computing
> and revealing randomness later on, which ensures the randomness is
> unbiasable and unpredictable.
 
### Batch threshold encryption scheme

The scheme is described in detail in the academic paper[^FPTX25e]. Below,
we present an abbreviated form of the interface which the scheme provides, taken from [here](https://github.com/aptos-labs/aptos-core/blob/1b896ef2a971b917ecfccef7322fd074d6cc7425/crates/aptos-batch-encryption/src/traits.rs#L10).

At a high level, the scheme allows for the following flow:

* At the beginning of the ech

```rust
pub trait BatchThresholdEncryption {

    // The trait's associated types are omitted from this description.

    /// Encrypt a plaintext with respect to any arbitrary associated data. This associated data is
    /// "bound" to the resulting CT, such that it will only verify with respect to the same
    /// associated data.
    fn encrypt<R: CryptoRng + RngCore>(
        ek: &Self::EncryptionKey,
        rng: &mut R,
        msg: &impl Plaintext,
        associated_data: &impl AssociatedData,
    ) -> Result<Self::Ciphertext>;

    /// Derive a digest from a [`DigestKey`] and a slice of ciphertexts.
    fn digest(
        digest_key: &Self::DigestKey,
        cts: &[Self::Ciphertext],
        round: Self::Round,
    ) -> Result<(Self::Digest, Self::EvalProofsPromise)>;

    /// Validators *must* verify each ciphertext before approving it to be decrypted, in order to
    /// prevent malleability attacks. Verification happens w.r.t. some associated data that was
    /// passed into the encrypt fn.
    fn verify_ct(ct: &Self::Ciphertext, associated_data: &impl AssociatedData) -> Result<()>;

    /// Although I'd like to expose as little of the identities as possible, Daniel told me that
    /// knowing the ID of a ciphertext will potentially help with deduplication.
    fn ct_id(ct: &Self::Ciphertext) -> Self::Id;

    /// Compute KZG eval proofs. This will be the most expensive operation in the scheme.
    fn eval_proofs_compute_all(
        proofs: &Self::EvalProofsPromise,
        digest_key: &Self::DigestKey,
    ) -> Self::EvalProofs;

    /// Compute KZG eval proofs. This will be the most expensive operation in the scheme. This
    /// version uses a different (slower for our parameter regime) multi-point-eval algorithm,
    /// from von zur Gathen and Gerhardt. Currently for benchmarking only, not for production use.
    fn eval_proofs_compute_all_vzgg_multi_point_eval(
        proofs: &Self::EvalProofsPromise,
        digest_key: &Self::DigestKey,
    ) -> Self::EvalProofs;

    fn eval_proof_for_ct(
        proofs: &Self::EvalProofs,
        ct: &Self::Ciphertext,
    ) -> Option<Self::EvalProof>;

    /// Derive a decryption key share given a [`SuccinctDigest`] and a round number, whose
    /// corresponding reconstructed decryption key will be able to decrypt any ciphertext encrypted
    /// to that round number and committed to by that digest.
    fn derive_decryption_key_share(
        msk_share: &Self::MasterSecretKeyShare,
        digest: &Self::Digest,
    ) -> Result<Self::DecryptionKeyShare>;

    fn verify_decryption_key_share(
        verification_key: &Self::VerificationKey,
        digest: &Self::Digest,
        decryption_key_share: &Self::DecryptionKeyShare,
    ) -> Result<()>;

    /// Reconstruct a decryption key from a set of [`DecryptionKeyShare`]s assuming the set of
    /// shares surpasses the threshold.
    fn reconstruct_decryption_key(
        shares: &[Self::DecryptionKeyShare],
        config: &Self::ThresholdConfig,
    ) -> Result<Self::DecryptionKey>;

    // TODO: verify decryption key?

    fn prepare_cts(
        cts: &[Self::Ciphertext],
        digest: &Self::Digest,
        eval_proofs: &Self::EvalProofs,
    ) -> Result<Vec<Self::PreparedCiphertext>>;

    /// Decrypt a set of ciphertext using a decryption key and advice.
    fn decrypt<P: Plaintext>(
        decryption_key: &Self::DecryptionKey,
        cts: &[Self::PreparedCiphertext],
    ) -> Result<Vec<P>>;

    fn decrypt_individual<P: Plaintext>(
        decryption_key: &Self::DecryptionKey,
        ct: &Self::Ciphertext,
        digest: &Self::Digest,
        eval_proof: &Self::EvalProof,
    ) -> Result<P>;
}
```


- Discuss technical goals of the system? (need to figure out how/where to discuss context-dependence)

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

**failed decryption could potentially halt the chain**
- describe how we implement in a way that prevents this from happening

**Simulation of encrypted txns is harder**
- trusted simulation-only nodes, run by foundation

**Max possible TPS is lower than unencrypted txn max TPS**
- We are making this feature optional. So max chain TPS will be unaffected. 
- List exploratory efforts to increase TPS?

**Has effect on e2e latency of chain**
- but net effect should be <10 milliseconds.
- We will skip all decryption computation if no encrypted txns are in a block, so blocks that don't use this feature will see no effect on latency

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

## References

[^FPTX25e]: **TrX: Encrypted Mempools in High Performance BFT Protocols**,
by Rex Fernando, Guru-Vamsi Policharla, Andrei Tonkikh, and Zhuolun Xiang,
2025, [[URL]](https://eprint.iacr.org/2025/2032.pdf)
