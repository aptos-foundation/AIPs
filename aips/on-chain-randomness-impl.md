---
aip: (this is determined by the AIP Manager, leave it empty when drafting)
title: Implementation of instant on-chain randomness
author: Alin Tomescu (alin@aptoslabs.com), Zhuolun "Daniel" Xiang (daniel@aptoslabs.com), Zhoujun Ma (zhoujun@aptoslabs.com)
discussions-to (*optional): <a url pointing to the official discussion thread>
Status: Draft
last-call-end-date (*optional): <mm/dd/yyyy the last date to leave feedbacks and reviews>
type: Standard (Core, Networking, Framework)
created: 02/12/2024
updated (*optional): <mm/dd/yyyy>
requires (*optional): <AIP number(s)>
---

# AIP-X - Implementation of instant on-chain randomness

## Summary

 > Summarize in 3-5 sentences what is the problem we’re solving for and how are we solving for it

This AIP describes the implementation of the randomness API from AIP-41[^aip-41], focusing on the cryptographic constructions and their efficient integration into our consensus protocol. Specifically, we describe how we use a weighted distributed key generation (DKG) protocol in a PoS setting to 

### Goals

 > What are the goals and what is in scope? Any metrics?
 > Discuss the business impact and business value this change would impact.

The goal is to provide Move smart contracts with access to (1) **instant**[^aip-41], (2) **unbiasable** and (3) **unpredictable** randomness w.r.t. to any minority stake of the validators.

At the same time, we must do this without imposing a high penalty on the blockchain’s latency or throughput.

### Out of Scope

 > What are we committing to not doing and why are they scoped out?

...

## Motivation

 > Describe the impetus for this change. What does it accomplish?
 > What might occur if we do not accept this proposal?

As already described in AIP-41[^aip-41] the need for on-chain randomness arises in many applications, such as decentralized games, raffles, randomized NFTs, randomized airdrops, and more. Plus, many blockchain applications will benefit from randomness in terms of fairness, security, and functionality.

## Impact

 > Which audiences are impacted by this change? What type of action does the audience need to take?

On-chain randomness interacts with & impacts our consensus protocol. The two protocols must be carefully co-designed to maintain performance, especially in terms of latency.

## Alternative solutions

 > Explain why you submitted this proposal specifically over alternative solutions. Why is this the best possible outcome?

**VDFs.** Current techniques based on verifiable delay functions (VDFs) introduce high latencies in the worst paths (TODO: cite bicorn). This does not meet the [goals](#Goals) described above.

**Interactive VSS and VRFs**. A different design would use a DKG based on interactive VSS to deal a secret amongst our validators. Unfortunately, this design requires that validators be 

**Other insecure approaches.**

## Specification

 > How will we solve the problem? Describe in detail precisely how this proposal should be implemented. Include proposed design principles that should be followed in implementing this feature. Make the proposal specific enough to allow others to build upon it and perhaps even derive competing implementations.

### Stake Rounding

Aptos Roll relies on rounding the stakes of each validator into a smaller *weight.* This is very good for achieving practical performance but has implications on secrecy and availability. Specifically, any rounding scheme will lead to **rounding errors**: i.e., some players might receive more secret shares than they deserve and other players might receive less. As a result, this effectively turns the threshold secret sharing scheme into a *ramp secret sharing scheme,* which has a different secrecy threshold and a different reconstruction threshold. Typically, the reconstruction threshold is higher. As a consequence, for liveness, the mechanism needs to ensure any 66% or more of the stake can reconstruct while secrecy holds against any 33% or less of the stake. To minimize the impact of MEV attacks, we chose to make the secrecy threshold even higher, setting it to 50% while still keeping the reconstruction threshold below 66%, to handle a 33% adversary.

Below we give a brief description of the rounding interface and its guarantees. More technical details of the rounding algorithm can be found in our paper[^DPTX24e].

#### Rounding interface

- **Inputs**:
  - `validator_stakes`: The stake distribution of the validators.
  - `secrecy_threshold_in_stake_ratio`: Any subset of validators with stake ratio ≤ this value cannot reveal the secret (randomness). Aptos uses 50% for this value in production.
  - `reconstruct_threshold_in_stake_ratio`: Any subset of validators with stake ratio ≥ this value can always reveal the secret (randomness). Aptos uses 66% for this value in production.
- **Output**:
  - `validator_weights`: The weight distribution assigned to the validators after rounding.
  - `reconstruct_threshold_in_weights`: Any subset of validators whose weights sum is ≥ this value can always reveal the secret (randomness).

#### Guarantees

When validators are assigned with weights according to `validator_weights`, any subset of validators that have a weight sum `≥ reconstruct_threshold_in_weights` must have stake ratio in the range `(secrecy_threshold_in_stake_ratio, reconstruct_threshold_in_stake_ratio]`. 

#### Rationale

Since in production `secrecy_threshold_in_stake_ratio` is `0.5`  and `reconstruct_threshold_in_stake_ratio` is `0.66`, the subset of validators that can reveal the secret (randomness) must have a stake ratio in `(0.5, 0.66]`. Due to the Proof-of-Stake assumption where the adversary owns at most `1/3` of the stake, the adversary cannot reveal the secret by itself (since `1/3 < 0.5`), and the honest validators can always reveal the secret by themselves (since `2/3 > 0.66`).

### System design

On-chain randomness introduces several changes to the current Aptos blockchain system, including running a wDKG for every epoch change, modifying the existing reconfiguration process, and generating a **randomness seed** for every block. This section describes the above system changes. 

More technical details of the design can be found in our paper[^DPTX24e].

#### Background on Aptos Blockchain

Aptos is a **proof-of-stake (PoS)** blockchain with a consensus algorithm that operates in periodic two-hour intervals known as **epochs**. The set of validators and their stake distribution remain fixed within each epoch, and can change across epoch boundaries. The validators of the next epoch do not come online until the new epoch starts.

The blockchain also decouples **consensus** (i.e., currently a BFT consensus protocol named [Jolteon](https://arxiv.org/abs/2106.10362)) from **execution** (i.e., an optimistic concurrency control execution engine named [BlockSTM](https://medium.com/aptoslabs/block-stm-how-we-execute-over-160k-transactions-per-second-on-the-aptos-blockchain-3b003657e4ba)), where each block is first finalized by consensus and then executed to update the blockchain state.

**Note:** This consensus-execution decoupling is especially important for on-chain randomness, because it allows the network to first commit to an ordering of transactions before computing and revealing randomness later on, which ensures the randomness is unbiasable and unpredictable.

#### Weighted Distributed Key Generation Using wPVSS

The goal of the wDKG is to have validators jointly generate a **shared secret**, which will be used to compute the randomness seed for every block. Aptos Roll runs a **non-interactive** wDKG *before* every epoch change. The design rationale is the following.

- Why use a weighted DKG instead of an unweighted DKG? As previously mentioned, the security of the on-chain randomness should hold under the PoS assumption. Therefore, the DKG needs to incorporate the stake of the validators when generating the shared secret for randomness generation. Specifically, the shared secret should only be reconstructible by a majority of the stake.
- Why run a wDKG before epoch change instead of after? If the wDKG starts after the epoch change, it is too late: the validators need to have had established a shared secret by the time the epoch starts. Otherwise, without such a shared secret, validators cannot process any transaction that requires randomness. As a result, we run the wDKG before the epoch change so that validators can generate randomness and process transactions immediately after entering the new epoch. 
- Why use a non-interactive wDKG based on wPVSS? The new validators of the next epoch may be offline until the new epoch starts. This means an interactive wDKG, which requires the new validators to interact with the current validators, is not feasible. In contrast, the non-interactive wDKG does not require the new validators to be online, and can use the blockchain as the broadcast channel among old and new validators when the epoch changes.

Here is the description of the non-interactive wDKG designed and implemented for Aptos Roll.

- When the current epoch reaches predefined limit (2 hours) or a governance proposal requires a reconfiguration, each validator will act as a *dealer*:
  - First, computes the weight distribution (i.e., `validator_weights` defined above)
  - Second, computes the reconstruction threshold (i.e., `reconstruct_threshold_in_weights` defined above) of the next-epoch validators via rounding,
  - Third, computes a **weighted publicly-verifiable secret sharing (wPVSS) transcript** based on the weight distribution and threshold and sends it to all validators via a reliable multicast.

- Once each validator receives a secure-subset of *valid transcripts* from 66% of the stake, it aggregates the valid transcript into a single final *aggregated transcript* and passes it on to consensus. More specifically, the validator will propose the aggregated wPVSS transcript via a new `ValidatorTransaction` variant `DKGResult`. Upon committing on the first `DKGResult` that contains a valid aggregated wPVSS transcript, validators finish the wDKG and start the new epoch.
  - The procedure so far is referred to as **async reconfiguration** across this AIP, and more implementation details are discussed [here](#how-to-land-new-reconfiguration-mode-async-reconfiguration).
- Finally, when the new epoch begins and the new validators are online, they can decrypt their shares of the secret from the aggregated transcript. At this point, the new validators will be ready to produce randomness for every block by evaluating a wVRF in a secret-shared manner, as we explain in a later section.

#### Randomness Generation Using wVRFs

In each epoch, the validators will collaborate to produce randomness for *every* block finalized by consensus, by evaluating a *weighted verifiable random function (wVRF)* using the shared secret established by the wDKG. 

- When a block achieves consensus finalization, each validator will use its decrypted share from the aggregated wPVSS transcript to produce its wVRF *share* for that block by evaluating the *wVRF* on block-specific unbiasable message (e.g., epoch number and round number), and reliably-multicast this share.
- Upon collecting wVRF shares that exceeds the reconstruction weight threshold (`reconstruct_threshold_in_weights` by the stake rounding algorithm), every validator will combine them and derive the same final wVRF *evaluation*, which is the same as evaluating the wVRF, under the shared secret, on the block-specific unbiasable message. Lastly, validators attach this wVRF *evaluation* as the block seed and send the block for execution.

Importantly, only 50% or more of the stake can compute the wVRF evaluation, which ensures **unpredictability**. Furthermore, the uniqueness property of wVRFs together with the secrecy of the wPVSS scheme ensure **unbiasability** against adversaries controlling less than 50% of the stake.

#### Consumption in user transactions

The randomness seed of a block will be published on chain in a new `BlockMetadataExt` transaction that goes before any user transaction within the same block.
A user transaction then combines the block-level seed and its unique transaction metadata to obtain the transaction-level randomness seed.

#### How to land: new internal transaction type: `BlockMetadataExt`
The wVRF evaluation of needs to be put on chain as the block randomness seed in the `BlockMetadata` transaction (always the 1st transction in a block).
To be backward-compatible, a new transaction type `BlockMetadataExt` is needed (and updating `BlockMetadata` transaction is impossible).
```rust
pub enum Transaction { // the internal transaction type
    UserTransaction(SignedTransaction),
    GenesisTransaction(WriteSetPayload),
    BlockMetadata(BlockMetadata),
    StateCheckpoint(HashValue),
    ValidatorTransaction(ValidatorTransaction),
    BlockMetadataExt(BlockMetadataExt), // new variant
}

pub enum BlockMetadataExt {
    V0(BlockMetadata),
    V1(BlockMetadataWithRandomness),
}

pub struct BlockMetadataWithRandomness {
    pub id: HashValue,
    pub epoch: u64,
    pub round: u64,
    pub proposer: AccountAddress,
    pub previous_block_votes_bitvec: Vec<u8>,
    pub failed_proposer_indices: Vec<u32>,
    pub timestamp_usecs: u64,
    pub randomness: Option<Randomness>, // The only new field compared with `BlockMetadata`
}
```

Transaction API considerations.
While doable, adding the corresponding external transaction type potentially breaks the downstream ecosystem and does not provide too much benefit.
It can be avoided by exporting `BlockMetadataWithRandomness` variant as the exiting `BlockMetadata` variant, with the `randomness` field ignored.

#### How to land: new validator transaction variant: `DKGResult`
A new validator transaction type `DKGResult` is needed to bring wDKG transcripts on chain.

```rust
pub enum ValidatorTransaction {
    ObservedJWKUpdate(jwks::QuorumCertifiedUpdate),
    DKGResult(DKGTranscript), // new variant
}

pub struct DKGTranscript {
    pub metadata: DKGTranscriptMetadata,
    pub transcript_bytes: Vec<u8>,
}

pub struct DKGTranscriptMetadata {
    pub epoch: u64,
    pub author: AccountAddress,
}
```

#### How to land: on-chain configuration refactoring

On-chain configurations are special on-chain resources that control validator component behaviors.
E.g. the consensus component reloads `ConsensusConfig` on new epoch start;
the block executor reloads `GasSchedule` and `Features` for every block.

Currently, on-chain config updates are done by modifying the on-chain resources directly then immediately an instant reconfiguration
(defined [here](#how-to-land-new-reconfiguration-mode-async-reconfiguration)).
This is to avoid the situation where a validator restarts and operates with the new config, while the others are on the old config.

To support both instant reconfiguration (when randomness is off) and async reconfiguration (when randomness is on),
the following changes are needed.
- On-chain config updates should go to a buffer instead of being applied immediately.
- In an epoch-switching transaction, all buffered updates should be applied.
- The existing apply-and-reconfigure APIs (e.g., `consensus_config::set()`) should be disabled.
- The `aptos_governance::reconfigure()` function should invoke instant reconfiguration if randomness is off,
  or start async reconfiguration otherwise.

These above allow the following config update pattern to work regardless of whether randomness is on/off.
```
config_x::set_for_next_epoch(new_config);
aptos_governance::reconfigure(&framework_signer);
```

Some reference implementation points.
- Updated `ConsensusConfig` [here](https://github.com/aptos-labs/aptos-core/blob/be0ef975cee078cd7215b3aea346b2d02fb0843d/aptos-move/framework/aptos-framework/sources/configs/consensus_config.move#L34-L63).
- Applied the new config update pattern [here](https://github.com/aptos-labs/aptos-core/pull/12420).


#### How to land: validator set locking during reconfiguration

While the buffers of most on-chain configs can keep accepting updates during DKG,
the validator set change buffer needs to be locked during reconiguration.
Otherwise, the voting power distribution and the VRF weight distribution may mismatch, which means the randomness is insecure.

This should be done by:
- introducing a global on-chain indicator of whether a reconfiguration is in progress;
- updating the indicator in reconfiguration operations.
- aborting any user transaction that may touch the next validator set, if any reconfiguration is in progress.

Some reference implementation points.
- The on-chain indicator [here](https://github.com/aptos-labs/aptos-core/blob/main/aptos-move/framework/aptos-framework/sources/reconfiguration_state.move).
- Updated public framework function `stake::leave_validator_set()` [here](https://github.com/aptos-labs/aptos-core/blob/59586fee4ebb88d659f0f74afa094d728cf32b5d/aptos-move/framework/aptos-framework/sources/stake.move#L1109).

#### How to land: new reconfiguration mode: async reconfiguration

The reconfiguration is a procedure to:
- increment the on-chain epoch counter;
- update `ValidatorSet`;
- emit a `NewEpochEvent` to trigger epoch-swtiching operations in valdiators.

The current reconfiguration does the above steps in one [Move function call](https://github.com/aptos-labs/aptos-core/blob/main/aptos-move/framework/aptos-framework/sources/reconfiguration.move#L96)
(so it is called **instant reconfiguration** across this AIP).

The on-chain randomness design requires the following **async reconfiguration** with 2 on-chain steps and 1 off-chain process.
- On-chain step 1.
  - Compute the next validator set as if epoch is being switched right now.
  - Lock the validator set change buffer.
  - Emit a `DKGStartEvent`.
- Off-chain process, where validators run wDKG, one of them obtains a wDKG transcript and proposes it as a transaction to trigger on-chain step 2.
  - Done in `DKGManager` as described in [this section](#how-to-land-dkgmanager-new-validator-component-to-execute-wdkg).
- On-chain step 2, triggered once a wDKG transcript is available.
  - Publish the wDKG transcript on chain.
  - Update `ValidatorSet`.
  - Unlock the validator set change buffer.
  - Apply all the buffered on-chain config changes.
  - Increment the on-chain epoch counter.
  - Emit a `NewEpochEvent` to trigger epoch-swtiching operations in valdiators.

See the reference implementation [here](https://github.com/aptos-labs/aptos-core/blob/main/aptos-move/framework/aptos-framework/sources/reconfiguration_with_dkg.move).

#### How to land: `DKGManager`: new validator component to execute wDKG
`DKGManager` is a new component that should run on every validator node to do the folowing.
- On `DKGStartEvent` triggered in the current epoch, run wDKG with peers.
  - It means to deal a transcript for the next validator set, exchange it with peers, and obtain an aggregated transcript with more than 1/3 voting power.
- Once an aggregated transcript is obtained, wrap it as a `DKGResult` validator transaction and propose it into the validator transaction pool.
  - [Validator Transaction](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-64.md) is required to be enabled.
- On `NewEpochEvent`, recall any proposed `DKGResult` transactions.
- On crash restart, check the on-chain DKG state. If the DKG for the current epoch is in progress, participate in it.

Implementation note: as long as the eventually accepted wDKG transcript can verify,
it is fine if validators equivocate on their transcripts or their local views of the aggregated transcript are different.
This can be utilized to implement `DKGManager` without persisting any state.

Reference implementation: https://github.com/aptos-labs/aptos-core/blob/df715afc2ca6646bcdee63e44e30c549ebe14bf3/dkg/src/dkg_manager/mod.rs#L51

#### How to land: consensus changes
- When proposing new blocks, include `DKGResult` validator transactions.
  - [Reference implementation](https://github.com/aptos-labs/aptos-core/blob/1de391c3589cf2d07cb423a73c4a2a6caa299ebf/consensus/src/liveness/proposal_generator.rs#L384-L403).
  Come for free if [Validator Transaction](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-64.md) is enabled.

- When verifying a block proposal, reject it if a `DKGResult` validator transaction is present but randomness is disabled.
  - This is a required security practice discussed in [AIP-64](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-64.md#security-considerations).
  - [Reference implmementation](https://github.com/aptos-labs/aptos-core/blob/1de391c3589cf2d07cb423a73c4a2a6caa299ebf/consensus/src/round_manager.rs#L687-L691).


#### How to land: `RandManager` to attach randomness seed to every block
A `RandManager` is needed between consensus and execution pipeline to do the following.
- On epoch start tasks.
  - Decrypt wVUF key shares from on-chain wDKG transcript.
  - Extra work if required by the actual wVRF schemes.
    - Generate augmented key pairs from wVRF key shares.
    - Exchange the augmented pub-keys with peers, obtain a quorum-cert for its own augmented pub-keys.
    - Exchange the quorum-certified augmented pub-keys with peers, and persist them for crash recovery.
- Receive the stream of ordered blocks from consensus.
- Ensure every ordered block has randomness seed (i.e., the wVRF evaludation of the block).
  - The wVRF evaludation is obtained by exchanging wVRF shares with peers, using its own augmented key pairs to sign and peers augmented public keys to verify.
- Forward the stream of randomness-ready blocks to the execution pipeline.

See reference implementation [here](https://github.com/aptos-labs/aptos-core/blob/1de391c3589cf2d07cb423a73c4a2a6caa299ebf/consensus/src/rand/rand_gen/rand_manager.rs#L50).

#### How to land: execution pipeline
In execution pipeline, a randomness-ready block is processed into a transaction list,
where the first transaction needs to be a `BlockMetadataExt` transaction to carry the block randomness seed.

See reference implementation [here](https://github.com/aptos-labs/aptos-core/blob/1de391c3589cf2d07cb423a73c4a2a6caa299ebf/consensus/src/state_computer.rs#L203).

#### How to land: Move VM changes
The Move VM needs to be able to execute the new transaction variants `BlockMetadataExt` and `ValidatorTransaction::DKGResult`,
which are the 2 steps of an async reconfiguration.

A `BlockMetadataExt` transaction should do what a `BlockMetadata` transaction does plus the following differences.
- On current epoch timeout, trigger async reconfiguration instead of instant reconfiguration.
  Recall that to trigger async reconfiguration means to:
  - finalize the next validator set,
  - lock the validator set resources,
  - emit a `DKGStartEvent` that contains the next validator set.
- Write the block randomness seed on chain, if it is available.

Like `BlockMetadata` transactions, `BlockMetadataExt` transactions should never abort.
See the reference implementation [here](https://github.com/aptos-labs/aptos-core/blob/1de391c3589cf2d07cb423a73c4a2a6caa299ebf/aptos-move/aptos-vm/src/aptos_vm.rs#L1935).

A `ValidatorTransaction::DKGResult` transaction should do the following.
- (a) Verify the aggregated wDKG transcript included.
- Unlock the validator set resources.
- Apply all pending on-chain config changes.
- Publish wDKG transcript on chain.
- Whatever is done in `BlockMetadata` transaction when epoch timeout is detected.

Malicious validators can cause step (a) to fail, in which case should cause the transaction to be discarded.
The remaining steps should never abort.
See the reference implementation [here](https://github.com/aptos-labs/aptos-core/blob/1de391c3589cf2d07cb423a73c4a2a6caa299ebf/aptos-move/aptos-vm/src/validator_txns/dkg.rs#L70).

## Reference Implementation

See the sub-sections above for the reference implementation of each component.

## Testing (Optional)

 > - What is the testing plan? (other than load testing, all tests should be part of the implementation details and won’t need to be called out)
 > - When can we expect the results?
 > - What are the test results and are they what we expected? If not, explain the gap.

Unit tests, smoke tests, forge tests.

Deploy a test network called `randomnet`.

Further stress testing in `previewnet`.

## Risks and Drawbacks

 > - Express here the potential negative ramifications of taking on this proposal. What are the hazards?
 > - Any backwards compatibility issues we should be aware of?
 > - If there are issues, how can we mitigate or resolve them?

**Potential bad state: stalled DKG**.
In case of implementation bugs/bad configurations, DKG may never finish,
so the new epoch won't come and buffered on-chain config updates won't be applied (though the chain doesn't halt).

**Validators fail to generate randomness**. If this happens, the blockchain will halt as every block needs randomness to proceed for execution.

**MEV attacks**. There is a risk of validators colluding together and leak the VRF secret key once the stake ratio of the malicious validators exceeds the secrecy threshold (50%). If this happens, the colluding validators can predict all randomness in the current epoch.

**Performance impact.** The randomness generation phase adds latency overhead in the block commit latency. More details can be found in our [paper](https://eprint.iacr.org/2024/198).

**Rounding errors.** With increasing the number of validators and/or sufficiently-bad stake distributions, the number of total secret shares outputted by our rounding algorithm can become larger and larger, degrading the performance of the wDKG phase and the per-block wVRF aggregation. **TODO:** address

**Reconfiguration impact**. The wDKG phase will affect the reconfiguration process. For periodic reconfigurations that happen every two hours, the validators need to finish the wDKG before the next epoch starts. For governance proposals that require reconfiguration, the changes by the governance proposal will be buffered on-chain, and applied after the wDKG finishes and validators enter the new epoch. During the wDKG period, changes to the `ValidatorSet` will be rejected. Any future new on-chain configs need to follow the same procedure.

**Shared secret being a group element has limited applications**. One limitation of the current implementation is that the shared secret of the wDKG is a group element instead of the field element. This means the shared secret cannot be used for other applications such as threshold decryption.

**Constraints on validator set size/total voting power.**
If the validator set size is too large, or the total voting power of the validator set is too large,
with small probability, the current rounding algorithm decides the wVRF parameters with the total weight being too large,
which causes the wDKG transcript to be too large and exceeds some transaction limits,
which leads to a stalled DKG.

Here are some related transaction limits.
- `max_bytes_per_write_op`: limit of the size of a single state item, 1MB currently.
- `ValidatorTxnConfig::V1::per_block_limit_total_bytes`: limit of the total validator transaction size in one block, 2MB currently.

**Validator set updates rejected during DKG**
In the current design, validator set changes are not allow during DKG.
Based on the latest mainnet simulation, it means for up to 30 secs in every 2 hours, validator set changes will fail.
This is a new negative user experience.

## Future Potential

 > Think through the evolution of this proposal well into the future. How do you see this playing out? What would this proposal result in one year? In five years?

...

## Timeline

### Suggested implementation timeline

 > Describe how long you expect the implementation effort to take, perhaps splitting it up into stages or milestones.

...

### Suggested developer platform support timeline

 > Describe the plan to have SDK, API, CLI, Indexer support for this feature is applicable. 

...

### Suggested deployment timeline

 > Indicate a future release version as a *rough* estimate for when the community should expect to see this deployed on our three networks (e.g., release 1.7).
 > You are responsible for updating this AIP with a better estimate, if any, after the AIP passes the gatekeeper’s design review.
 > 
 > - On devnet?
 > - On testnet?
 > - On mainnet?

Targeting release v1.11

## Security Considerations

 > - Does this result in a change of security assumptions or our threat model?
 > - Any potential scams? What are the mitigation strategies?
 > - Any security implications/considerations?
 > - Any security design docs or auditing materials that can be shared?

Test-and-abort attach preventions.

Under-gasing attack preventions.

**TODO:** anything else

## Open Questions (Optional)

 > Q&A here, some of them can have answers some of those questions can be things we have not figured out but we should

## References

[^aip-41]: https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-41.md
[^DPTX24e]: **Distributed Randomness using Weighted VRFs**, by Sourav Das and Benny Pinkas and Alin Tomescu and Zhuolun Xiang, 2024, [[URL]](https://eprint.iacr.org/2024/198)
