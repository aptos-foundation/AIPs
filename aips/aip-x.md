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

-------------------------------
START READING HERE

 > How will we solve the problem? Describe in detail precisely how this
 > proposal should be implemented. Include proposed design principles that
 > should be followed in implementing this feature. Make the proposal
 > specific enough to allow others to build upon it and perhaps even derive
 > competing implementations.


### Background on Aptos blockchain
 

AIP-79[^AIP-79] gives an overview of the Aptos blockchain, quoted below,
which is useful for understanding the modifications made by the encrypted
mempool.

> Aptos is a **proof-of-stake (PoS)** blockchain with a consensus algorithm
> that operates in periodic two-hour intervals known as **epochs**. The set
> of validators and their stake distribution remain fixed within each
> epoch, and can change across epoch boundaries. The validators of the next
> epoch do not come online until the new epoch starts.
>
> The blockchain also decouples **consensus** from **execution**, where
> each block is first finalized by consensus and then executed to update
> the blockchain state. This consensus-execution decoupling is especially
> important for on-chain randomness, because it allows the network to first
> commit to an ordering of transactions before computing and revealing
> randomness later on, which ensures the randomness is unbiasable and
> unpredictable.
 
### The flow of transactions through the encrypted mempool

We describe at a high level the flow which the system enables, and how it
touches each component of the system. Then, in the following sections, we
elaborate on these components, the interfaces which they provide, and the
manner in which they interact.

* Before the system is deployed, a trusted setup ceremony is run. The
  validators must load the result of this ceremony before starting.
* At the beginning of the epoch, the validators obtain the encryption
  key for this epoch, which was generated and posted on-chain by the
  previous epoch's validators during the DKG. Each validator also
  obtains an encryption of its master secret key share, which it can
  decrypt with its consensus key.
* At any time, a client may submit a transaction with an encrypted payload.
  To encrypt the payload, the client must fetch the current encryption
  key from on-chain. Both the fetching of the encryption key and the
  encryption of the payload will be handled by the Aptos typescript SDK.
* Whenever the validators receives a block proposal from the leader which
  contains valid encrypted pending transactions, they use the batch
  threshold encryption scheme to generate decryption key shares, which they
  then broadcast after reaching consensus on the block. Finally, they use
  these shares to reconstruct the decryption key and to decrypt the
  ciphertexts. These computations are integrated into consensus in
  a pipelined manner, to avoid as much as possible computation on the
  critical path.
 
### The batch threshold encryption scheme

The scheme is described in detail in the academic paper[^FPTX25e], and its
cryptographic details are out-of-scope for this AIP. Below, we discuss the
scheme and its required efficiency and security properties at a high level,
and then we present an abbreviated form of the interface which the scheme
provides, taken from [the source
code](https://github.com/aptos-labs/aptos-core/blob/1b896ef2a971b917ecfccef7322fd074d6cc7425/crates/aptos-batch-encryption/src/traits.rs#L10).

**The batch threshold encryption flow, in more detail.** As explained
above, the scheme is integrated into consensus, allowing the validators to
agree on a set of ciphertexts, and to decrypt this set immediately after
consensus is reached on the block. Specifically, the points in the above
outline which involve the batch encryption scheme can be expanded as
follows: 
* The leader proposes a block containing encrypted transactions. Each of
  these transactions should be verified by the leader using `verify_ct`
  before proposing; if verification fails on some of the ciphertexts in
  a block, the block is considered invalid. 
* After receiving a block proposal from the leader, each validator first
  invokes `verify_ct` on each ciphertext. If all ciphertexts are
  valid, the validator uses the `digest` method
  on the set of ciphertexts in the block to compute a constant-sized
  `Digest` and an `EvalProofsPromise`. `digest` additionally requires as
  input a `DigestKey`, which is a file generated by the trusted setup
  ceremony and loaded by each validator.
* During the voting rounds, each validators performs precomputation to
  prepare for decryption. Specifically:
  * It invokes `eval_proofs_compute_all` on the `EvalProofsPromise` to
    obtain `EvalProofs`. 
  * It invokes `prepare_cts`, which takes as input the ciphertexts, the
    `Digest`, and the `EvalProofs`, and outputs
    a `Vec<PreparedCiphertexts>`.
* Also during voting rounds, each validators invokes
  `derive_decryption_key_share`, which takes as input the `Digest` and the
  validator's `MasterSecretKeyShare`, and outputs a `DecryptionKeyShare`.
  _It does not broadcast this share until it receives consensus votes
  confirming the block._
* Once the block is confirmec, each validator broadcasts this to the other
  validators.
* Finally, after receiving a threshold of `DecryptionKeyShare`s, each
  validators runs `reconstruct_decryption_key` to obtain the
  `DecryptionKey` for the block, and uses this to `decrypt` all of the
  `PreparedCiphertext`s. This is the only computation on the critical path,
  and is sped up greatly by the precomputation described above.

**Efficiency properties.**
* The ciphertexts should have a small additive overhead relative to payload
  plaintexts. [Rex: fill in concrete sizes]
* The digest should be constant-sized, independent of the number of
  ciphertexts in the batch. Specifically, in our scheme, it is 48 bytes.
* The decryption key shares and decryption key should also be
  constant-sized. Specifically, in our scheme, they are 48 bytes each.
* The amount of work to derive shares and reconstruct the decryption key
  should be constant.
* The on-critical path computation should be as efficient as possible, to
  avoid affecting latency of the network.

**Security guarantees.** We describe informally the guarantees our scheme
provides, and defer a formal description to the academic paper[^FPTX25e].
* Robustness: As long as a specified threshold of decryption key shares are
  computed honestly, the (honest) validators should all produce the same
  plaintexts at the end of consensus.  This should be the case even in the
  presence of malicious ciphertexts, or malicious decryption key shares, or
  both.
* Rogue ciphertext security: Honest parties' ciphertexts should be
  decryptable even if an adversary adds arbitrary other malicious
  ciphertexts to the batch.
* Hiding of non-decrypted ciphertexts: A decryption key should have the
  power only to decrypt ciphertexts that were committed to as part of the
  digest. Any other ciphertexts should reveal nothing about the plaintexts
  even in the presence of the decryption key.
* Non-malleability: We must rule out attacks where an adversary (say
  a malicious fullnode) receives a ciphertext from a user, changes it
  slightly, and then submits it for decryption.
* Context-dependence: An adversary must not be able to combine decryption
  key shares across different rounds to derive any new valid decryption
  key.


#### Non-malleability, and associated data

Although all security properties are formalized and proven in the academic
paper, non-malleability particularly important and nuanced. Because of
this, we pay special attention to it in the AIP. Below, we discuss some
attack scenarios related to non-malleability.

**Submitting a mauled ciphertext:** Imagine that a malicious fullnode
receives a transaction with an encrypted payload from a user, then "mauls"
the payload, i.e., replaces it with a modified ciphertext based on the
original. It then resigns the modified transaction using its own key, and
submits to the validators. After decryption, the plaintext is close enough
to the user's original plaintext payload to reveal the user's intent, but
via the ciphertext modification is mangled just enough to not be valid. 

It is clear that we must prevent this scenario. Specifically, we ensure
that any modification to a ciphertext which would change the underlying
plaintext immediately renders it invalid, so that `verify_ct` fails.

**Claiming ownership of a ciphertext:** Besides modifying an encrypted
payload, a malicious fullnode may simply pass the payload off as its own.
That is, when it receives a transaction with an encrypted payload from
a user, it can simply construct a new transaction with same encrypted
payload as-is, sign the transaction as its own, and submit. Even if the
plaintext contains the sender public key, this is not verifiable until
after decryption. As soon as the fullnode's malicious transaction gets
included in a block and decrypted, the user's transaction intent is
revealed.

We must also present this type of payload theft. We do this using the
notion of _encryption with associated data._ When encrypting, the user
specifies some "associated data," in our case, the sending address. The
resulting ciphertext is then verified with respect to this same sending
address. We ensure that just as above, any change in the sending address
immediately renders the `(ct, sender)` pair invalid, so that `verify_ct`
fails.

**Formalizing these and other attack scenarios.** In the paper[^FPTX25e],
we formalize a variant of CCA2-security, adapted to batch threshold
encryption, which captures security against these and other types of
attacks. We give a formal proof that our scheme satisfies this security
definition.

#### The interface spec

The rust code which describes the interface that the batch encryption
scheme provides is below. For clarity, the trait's associated types are
omitted.

```rust
pub trait BatchThresholdEncryption {

    // The trait's associated types are omitted from this description.

    fn digest(
        digest_key: &Self::DigestKey,
        cts: &[Self::Ciphertext],
        round: Self::Round,
    ) -> Result<(Self::Digest, Self::EvalProofsPromise)>;

    fn verify_ct(ct: &Self::Ciphertext, associated_data: &impl AssociatedData) -> Result<()>;

    fn ct_id(ct: &Self::Ciphertext) -> Self::Id;

    fn eval_proofs_compute_all(
        proofs: &Self::EvalProofsPromise,
        digest_key: &Self::DigestKey,
    ) -> Self::EvalProofs;

    fn eval_proof_for_ct(
        proofs: &Self::EvalProofs,
        ct: &Self::Ciphertext,
    ) -> Option<Self::EvalProof>;

    fn derive_decryption_key_share(
        msk_share: &Self::MasterSecretKeyShare,
        digest: &Self::Digest,
    ) -> Result<Self::DecryptionKeyShare>;

    fn verify_decryption_key_share(
        verification_key: &Self::VerificationKey,
        digest: &Self::Digest,
        decryption_key_share: &Self::DecryptionKeyShare,
    ) -> Result<()>;

    fn reconstruct_decryption_key(
        shares: &[Self::DecryptionKeyShare],
        config: &Self::ThresholdConfig,
    ) -> Result<Self::DecryptionKey>;

    fn verify_decryption_key(
        encryption_key: &Self::EncryptionKey,
        digest: &Self::Digest,
        decryption_key: &Self::DecryptionKey,
    ) -> Result<()>;

    fn prepare_cts(
        cts: &[Self::Ciphertext],
        digest: &Self::Digest,
        eval_proofs: &Self::EvalProofs,
    ) -> Result<Vec<Self::PreparedCiphertext>>;

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



### The DKG

The batch threshold encryption scheme requires the validators to share
a field-element secret key. Clients must encrypt to the corresponding
group-element public key. The Aptos network already runs a DKG every epoch
which establishes a shared secret key for on-chain randomness[^AIP-79], but
this secret key is a _group element_, and thus is incompatible with our
scheme. Because of this, we construct a new DKG which is also run by the
validators every epoch.

As with the randomness DKG, our DKG is based on non-interactive PVSS, this
time for field elements. The new PVSS scheme is described in a technical
blog post[^chunky], and its formal description is out-of-scope for this
AIP. Aside from being a field-element PVSS instead of a group-element PVSS,
two key differences separate it from the randomness PVSS:

* It is not aggregatable. That is, it is not possible to aggregate many
  transcripts into one in a way that sums the corresponding secrets and
  shares and maintains verifiability.
* Although it is not aggregatable, it has an aggregatable but
  non-verifiable subtranscript. 

We design the new DKG around these differences. The DKG will have an
agreement phase designed to work with a non-aggregatable PVSS scheme, and
to prevent unnecessary communication overhead. Specifically:

1. As with the previous DKG, each party will start by disseminating
   a transcript.
2. One of the validators (e.g. the consensus leader) broadcast a _proposal_
   $(Q, H(\mathsf{subtrx}))$ consisting of a set $Q$ of party indices along
   with the hash of a subtranscript $\mathsf{subtrx}$, which is claimed to
   be the aggregation of the transcripts from the parties in $Q$. Note that
   this proposal is succinct; the proposer does not send the individual
   subtranscripts which were aggregated to produce $\mathsf{subtrx}$.
3. Each validator signs the proposal if the following hold:
   - the weights of the parties in $Q$ pass the threshold
   - it has received the transcript from every party in $Q$ and has
     verified them
   - It has verified that the subtranscripts from parties in $Q$ aggregate
     to $\mathsf{subtrx}$ (checked via the hash).

Details of this agreement phase are in the technical blog post.[^chunky]


### The trusted setup

The trusted setup consists of many shifts of a single powers-of-tau setup.
Its specific structure is described in the paper[^FPTX25e]; more details on
the ceremony design and implementation will follow.

### The new transaction format

The fullnode will accept a new type of transaction with an encrypted
payload. This new encrypted payload type `EncryptedPayload` is defined 
[here](https://github.com/aptos-labs/aptos-core/blob/main/types/src/transaction/encrypted_payload.rs), and is presented below.

```rust
pub enum EncryptedPayload {
    Encrypted {
        ciphertext: Ciphertext,
        extra_config: TransactionExtraConfig,
        payload_hash: HashValue,
    },
    FailedDecryption {
        ciphertext: Ciphertext,
        extra_config: TransactionExtraConfig,
        payload_hash: HashValue,
        eval_proof: EvalProof,
    },
    Decrypted {
        ciphertext: Ciphertext,
        extra_config: TransactionExtraConfig,
        payload_hash: HashValue,
        eval_proof: EvalProof,

        // decrypted things
        executable: TransactionExecutable,
        decryption_nonce: u64,
    },
}
```

```rust
pub struct PayloadAssociatedData {
    sender: AccountAddress,
}
```


The goals of this payload format are: 
* to represent the transaction throughout its lifecycle (encrypted when
  first received, then decrypted, or failed to decrypt after consensus).
* to authenticate the plaintext payload contents. 
* to ensure we are using the non-malleability features of the batch
  threshold encryption scheme in order to avoid vulnerabilities.
* to integrate well with account abstraction.

[Rex: I don't remember why the encrypt->sign design integrates better with
account abstraction than the sign->encrypt->sign design. Need to ask
someone about this.]

To achieve these goals, we layer encryption and signing in the following
manner.
1. First, a single-use `decryption_nonce: u64` chosen at random.
2. Then, the pair `(executable, decryption_nonce)` is encrypted, with
   associated data `PayloadAssociatedData` containing the `sender`.
3. The value `payload_hash = H(decryption_nonce, executable, sender,
   sequence_number)` is computed. This is a hiding commitment to
   `(executable, sender, sequence_number)`.
4. Finally, the `EncryptedPayload::Encrypted` enum variant is initialized
   with the `ciphertext` and the `payload_hash`. This is signed by the
   user's signing key as part of the final transaction being submitted.
   [Rex: explain extra_config?]


This design means that by signing the transaction, the user signs both the
ciphertext and a hiding commitment to the transaction payload contents.
After decryption, since the commitment randomness `decryption_nonce` is
revealed as part of the plaintext, validators and fullnodes may verify the
signature and the commitment computation to establish authenticity of the
payload, without touching the ciphertext. Inclusion of the `sender` in the
`PayloadAssociatedData` means that authenticity of the ciphertext can be
verified with respect to whatever signed the transaction, which precludes
attacks such as the one described in the previous section.

In the case of a failed decryption, the result is stored in the
`FailedDecryption` variant. During replay, fullnodes may verify the block
decryption key using `verify_decryption_key`, and then may verify the
decryption failure.


[TODO: talk about
* `extra_config`?
* Double-check hash computation (is it actually implemented yet?)
]

### The SDK modifications

The goal of the encrypted mempool project is privacy of transaction
payloads, and we achieve this by encrypting payloads before they reach the
fullnode. It follows that *this encryption must be done client-side.*
Specifically, either the user’s wallet or the SDK must allow for performing
this encryption. 

We will support three different client-side flows:

- **Without wallet interaction:** encrypt and then sign on SDK side.
    - Comparatively, this requires the highest level trust in the dApp,
      since it’s assumed the dApp (i.e., the SDK) has access to the signing
      key.
- **With a wallet that has support for our feature:** encrypt and then
  sign, all on the wallet side.
    - This is the best in terms of trust (i.e., user only needs to trust
      the wallet). The wallet can present the transaction in the clear to
      the user for approval.
    - Requires modifying the [wallet standard](https://github.com/aptos-labs/wallet-standard/blob/main/src/features/aptosSignAndSubmitTransaction.ts)
      to add a new feature (e.g. `aptosEncryptSignAndSubmitTransaction`),
      and then implementing that feature in e.g. Petra.
- **With wallet interaction, but with a wallet that doesn’t support this
  feature natively:** encrypt on SDK side, then sign on the wallet side.
    - This is a backup option which would not provide good UX. Although the
      wallet has final control, it is signing an encrypted payload. This
      means the confirmation screen will be unintelligible, and the wallet
      will not be able to simulate.


-------------------------------
STOP READING HERE

## Reference Implementation

* The batch encryption scheme is located at [https://github.com/aptos-labs/aptos-core/tree/main/crates/aptos-batch-encryption](https://github.com/aptos-labs/aptos-core/tree/main/crates/aptos-batch-encryption).
* The PVSS scheme is located at [https://github.com/aptos-labs/aptos-core/tree/main/crates/aptos-dkg/src/pvss/chunky](https://github.com/aptos-labs/aptos-core/tree/main/crates/aptos-dkg/src/pvss/chunky).
* The typescript encrypt function is located at [https://github.com/aptos-labs/aptos-core/tree/enc_txn_typescript_tests_3/crates/aptos-batch-encryption/ts-batch-encrypt](https://github.com/aptos-labs/aptos-core/tree/enc_txn_typescript_tests_3/crates/aptos-batch-encryption/ts-batch-encrypt).

## Testing 

Unit tests for each component, smoke tests, forge tests/benchmarks.

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

**The max possible encrypted transaction TPS is lower than the max TPS for
unencrypted transactions.**
- We are making this feature optional. So the max chain TPS will be unaffected. 
- We are also exploring efforts to increase TPS with this system:
  - Issuing multiple decryption keys per block
  - Cryptography algorithmic improvements to increase performance

**This system has an effect on end-to-end latency of chain.**
- This net effect should be <10 milliseconds though.
- We will skip all decryption computation if no encrypted txns are in
  a block, so blocks that don't use this feature will see no effect on
  latency.

**Privacy-preserving simulation of encrypted transactions.** Currently in
the SDK, the default behavior is to send a transaction to the same fullnode
both for simulation and for submission. Since transactions sent for
simulation must be sent in the clear, this means the fullnode might be able
to use a statistical/timing analysis to associate the final encrypted
transaction with the cleartext version, breaking privacy.
- We plan to fix this issue by providing sane defaults. Some options:
  - When building a transaction with the encryption feature on, we can
    default to sending to a different fullnode for simulation than the one
    that will be used for submission. Taking this further, we can spin up
    "simulation-only" fullnodes which take care of simulating encrypted
    transactions.
  - Simply disable simulation by default when encryption is on.


## Future Potential/Open Questions

 > Think through the evolution of this proposal well into the future. How do you see this playing out? What would this proposal result in one year? In five years?

- future plans: hide sender?

## Timeline

### Suggested implementation timeline

 > Describe how long you expect the implementation effort to take, perhaps splitting it up into stages or milestones.

- Finishing validator code now, expect to be done end of January.
- Afterwards, SDK engineer will finish SDK. Integration must wait for the
  validator code to hit devnet in order to test. Estimate is that final
  integration will take a couple days.
- Plan to run trusted setup ceremony sometime in February.

### Suggested deployment timeline

 > **Optional:** Indicate a future release version as a *rough* estimate for when the community should expect to see this deployed on our three networks (e.g., release 1.7).
 > You are responsible for updating this AIP with a better estimate, if any, after the AIP passes the gatekeeper’s design review.
 >
 > - On devnet?
 > - On testnet?
 > - On mainnet?

Devnet end of Jan/early February, mainnet end of Feburary/early march,
testnet somewhere in between.


...

## References

[^FPTX25e]: **TrX: Encrypted Mempools in High Performance BFT Protocols**,
by Rex Fernando, Guru-Vamsi Policharla, Andrei Tonkikh, and Zhuolun Xiang,
2025, [[URL]](https://eprint.iacr.org/2025/2032.pdf)

[^AIP-79]: **AIP-79: Implementation of instant on-chain randomness,**,
by Alin Tomescu, Zhuolun Xiang, and Zhoujun Ma.
2024, [[URL]](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-79.md#background-on-aptos-blockchain)

[^chunky]: [https://alinush.github.io/chunky](https://alinush.github.io/chunky).
