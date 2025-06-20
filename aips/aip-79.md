---
aip: 79
title: Implementation of instant on-chain randomness
author: Alin Tomescu (alin@aptoslabs.com), Zhuolun "Daniel" Xiang (daniel@aptoslabs.com), Zhoujun Ma (zhoujun@aptoslabs.com)
discussions-to (*optional): <a url pointing to the official discussion thread>
Status: Accepted
last-call-end-date (*optional): <mm/dd/yyyy the last date to leave feedbacks and reviews>
type: Standard (Core, Networking, Framework)
created: 02/12/2024
updated (*optional): <mm/dd/yyyy>
requires (*optional): <AIP number(s)>
---

# AIP-79 - Implementation of instant on-chain randomness

## Summary

This AIP describes the implementation of the randomness API from AIP-41[^aip-41] on top of Aptos blockchain, which is to provide Move smart contracts with access to (1) **instant**, (2) **unbiasable** and (3) **unpredictable** randomness under the proof-of-stake assumption that secures the blockchain itself. 
The implementation should also be efficient, i.e., negligible impact to the throughput or latency of the blockchain system. 
The AIP will focus on the on-chain randomness protocol description and implementation, and the efficient blockchain system integrations. 
Specifically, we describe how we implement a weighted distributed key generation (DKG) protocol in a PoS setting to set up threshold keys among the validators, and have validators generate randomness every block using their keys and a weighted verifiable unpredictable function (VUF). We will also describe other major system changes such as reconfiguration changes and Aptos VM changes.

### Out of Scope

The formal description of the cryptography scheme and its security argument is out of scope, as they are described in our paper[^DPTX24e]. 
The randomness API specification and its design rationale is out of scope, as they are already covered in AIP-41[^aip-41].
The AIP focuses on how we integrate the cryptographic primitives into Aptos blockchain system to construct an end-to-end instant on-chain randomness system.


## Motivation

As already described in AIP-41[^aip-41] the need for on-chain randomness arises in many applications, such as decentralized games, raffles, randomized NFTs, randomized airdrops, and more. Plus, many blockchain applications will benefit from randomness in terms of fairness, security, and functionality.

## Impact

**Validator network performance**.
On-chain randomness interacts with and impacts our blockchain protocol running by the validators. The two protocols must be carefully co-designed to maintain performance, especially in terms of latency. The performance testing from previewnet demonstrates our implementation adds small latency overhead (tens of milliseconds) in end-to-end transaction latency under various load tests.

**Ecosystem impact**.
Downstreams such as indexer and SDK need to support the new transaction types added by this implementation, as described in [New transaction types](#new-transaction-types).

## Alternative solutions

**External trust and non-PoS**. 
Using external beacons like [Drand](https://drand.love/docs/overview/#how-drand-works) requires applications to place external trust in the randomness beacon’s security and availabilty. Furthermore, the randomness cannot be consumed instantly, but via a commit-and-reveal process, which makes development more cumbersome and access to randomness more delayed.
[DFINITY](https://internetcomputer.org/whitepaper.pdf) relies on a unweighted threshold cryptography to build its on-chain randomness, rather than weighted ones. This is because DFINITY assumes a non-PoS security model where the chain remains secure as long as no more than one third of the validators (rather than the stake) is compromised. This threshold setting is much easier than Aptos’s weighted setting because the total number of shares can be set to the number of validators (e.g., hundreds). In contrast, in Aptos’s weighted setting, the total number of shares is proportional to the total stake which, even if rounded down, could be larger (e.g., hundreds to thousands).

**VDFs.** Current techniques based on verifiable delay functions (VDFs) introduce high latencies in the worst paths (such as [Bicorn](https://eprint.iacr.org/2023/221)), which is undesirable for high performance blockchains such as Aptos. 

**Interactive VSS and VUFs**. A different design would use a DKG based on interactive VSS to deal a secret amongst our validators. Unfortunately, this design requires that new-epoch validators be online when setting up their threshold keys for randomness generation, which does not align with the current system architecture of Aptos.

**Other insecure approaches.** Several existing blockchains have insecure on-chain randomness implementations, as described in our [blog post](https://aptoslabs.medium.com/roll-with-move-secure-instant-randomness-on-aptos-c0e219df3fb1). Those approaches are either biasable or predictable, making it impossible for developers or users to use on-chain randomness safely. 

## Specification

On-chain randomness introduces several changes to the current Aptos validators, including running a DKG for every epoch change, modifying the existing reconfiguration process, and generating a **randomness seed** for every block. This section describes the above system changes at a high level. Implementation details are discussed in [Reference Implementation](#reference-implementation).

### Background on Aptos blockchain

Aptos is a **proof-of-stake (PoS)** blockchain with a consensus algorithm that operates in periodic two-hour intervals known as **epochs**. The set of validators and their stake distribution remain fixed within each epoch, and can change across epoch boundaries. The validators of the next epoch do not come online until the new epoch starts.

The blockchain also decouples **consensus** (i.e., currently a BFT consensus protocol named [Jolteon](https://arxiv.org/abs/2106.10362)) from **execution** (i.e., an optimistic concurrency control execution engine named [BlockSTM](https://medium.com/aptoslabs/block-stm-how-we-execute-over-160k-transactions-per-second-on-the-aptos-blockchain-3b003657e4ba)), where each block is first finalized by consensus and then executed to update the blockchain state. This consensus-execution decoupling is especially important for on-chain randomness, because it allows the network to first commit to an ordering of transactions before computing and revealing randomness later on, which ensures the randomness is unbiasable and unpredictable.

### Design overview

This section presents a high-level overview of the implementation design, including cryptography primitives, weighted distributed key generation and randomness generation. 

Aptos on-chain randomness first rounds the stakes of each validator into smaller *weights*, which guarantees efficiency under proof-of-stake security. The details of stake rounding is deferred to ["Stake rounding"](#stake-rounding). For this section, we assume the validators have the weight distribution output by stake rounding. 

#### How it works

Roughly speaking, the validators establish a shared secret key, and use their secret key shares to compute a randomness seed for every block, which is used to pseudo-randomly derive the randomness for every API call in that block.
The first part is known is distributed key generation (DKG), and second part as randomness generation. 
DKG is performed at the end of each epoch to setup the keys for the randomness generation of next epoch.
This shared secret key can only be reconstructed by 50% or more of the stake and therefore can be safely used to compute a randomness seed for every block in that epoch.
The seed is computed by evaluating a weighted verifiable random function (wVRF) under this shared secret over a block-specific unbiasable message (e.g., epoch number and round number).

#### Weighted Distributed Key Generation (DKG) using wPVSS

The goal of the DKG is to have validators jointly generate a **shared secret key**, which will be used to compute the randomness seed for every block.
Here is the description of the non-interactive DKG designed and implemented for Aptos on-chain randomness.

- When the current epoch reaches predefined limit (2 hours) or a governance proposal requires a reconfiguration, each validator will act as a *dealer* and compute a **weighted publicly-verifiable secret sharing (wPVSS) transcript** based on the weight distribution and threshold and exchange it with all validators via a reliable multicast. This transcript will contain, for each validator, an encryption of that validator’s secret key share of the random value that was dealt. 

- Once each validator receives a secure-subset of *valid transcripts* from 66% of the stake, it aggregates the valid transcript into a single final *aggregated transcript* and passes it on to consensus. Upon consensus finalizing on the first valid aggregated wPVSS transcript, validators finish the DKG and start the new epoch.

- Finally, when the new epoch begins and the new validators are online, they can decrypt their shares of the secret key from the aggregated transcript. At this point, the new validators will be ready to produce randomness for every block by evaluating a VUF in a secret-shared manner, as we explain in a later section.

As described, Aptos on-chain randomness runs a **non-interactive** DKG *before* every epoch change. 
The design rationale is the following.

- Why use a weighted DKG instead of an unweighted DKG? As previously mentioned, the security of the on-chain randomness should hold under the PoS assumption. Therefore, the DKG needs to incorporate the stake of the validators when generating the shared secret key for randomness generation. Specifically, the shared secret key should only be reconstructible by a majority of the stake.
- Why run a DKG before epoch change instead of after? If the DKG starts after the epoch change, it is too late: the validators need to have had established a shared secret key by the time the epoch starts. Otherwise, without such a shared secret key, validators cannot process any transaction that requires randomness. As a result, we run the DKG before the epoch change so that validators can generate randomness and process transactions immediately after entering the new epoch. 
- Why use a non-interactive DKG based on wPVSS? The new validators of the next epoch may be offline until the new epoch starts. This means an interactive DKG, which requires the new validators to interact with the current validators, is not feasible. In contrast, the non-interactive DKG does not require the new validators to be online, and can use the blockchain as the broadcast channel among old and new validators when the epoch changes.


#### Randomness generation using VUFs

In each epoch, the validators will collaborate to produce randomness for *every* block finalized by consensus, by evaluating a *weighted verifiable unpredictable function (VUF)* using the shared secret key established by the DKG. 

- When a block achieves consensus finalization, each validator will use its decrypted share from the aggregated wPVSS transcript to produce its VUF *share* for that block by evaluating the *VUF* on block-specific unbiasable message (e.g., epoch number and round number), and reliably-multicast this share.
- Upon collecting VUF shares that exceeds the reconstruction weight threshold, every validator will combine them and derive the same final VUF *evaluation*, which is the same as evaluating the VUF, under the shared secret key, on the block-specific unbiasable message. Lastly, validators attach this VUF *evaluation* as the block seed and send the block for execution.

Importantly, only 50% or more of the stake can compute the VUF evaluation, which ensures **unpredictability**. Furthermore, the uniqueness property of VUFs together with the secrecy of the wPVSS scheme ensure **unbiasability** against adversaries controlling less than 50% of the stake.

**Consume randomness in user transactions**. The randomness seed of a block will be published on chain in a new block metadata transaction that goes before any user transaction within the same block. A user transaction then combines the block-level seed and its unique transaction metadata to obtain the transaction-level randomness seed.

## Reference Implementation

This section describes the implementation of each components in detail, including staking rounding, new transaction types, reconfiguration related changes, DKG related changes and randomness generation related changes. 

### Stake rounding

Aptos on-chain randomness relies on rounding the stakes of each validator into a smaller *weight.* This is very good for achieving practical performance but has implications on secrecy and availability. Specifically, any rounding scheme will lead to **rounding errors**: i.e., some players might receive more secret shares than they deserve and other players might receive less. As a result, this effectively turns the threshold secret sharing scheme into a *ramp secret sharing scheme,* which has a different secrecy threshold and a different reconstruction threshold. Typically, the reconstruction threshold is higher. As a consequence, for liveness, the mechanism needs to ensure any 66% or more of the stake can reconstruct while secrecy holds against any 33% or less of the stake. To minimize the impact of MEV attacks, we chose to make the secrecy threshold even higher, setting it to 50% while still keeping the reconstruction threshold below 66%, to handle a 33% adversary.

Below we give a brief description of the rounding interface and its guarantees. More technical details of the rounding algorithm can be found in our paper[^DPTX24e].

**Rounding interface**.

- **Inputs**:
  - `validator_stakes`: The stake distribution of the validators.
  - `secrecy_threshold_in_stake_ratio`: Any subset of validators with stake ratio ≤ this value cannot reveal the secret (randomness). Aptos uses 50% for this value in production.
  - `reconstruct_threshold_in_stake_ratio`: Any subset of validators with stake ratio ≥ this value can always reveal the secret (randomness). Aptos uses 66% for this value in production.
- **Outputs**:
  - `validator_weights`: The weight distribution assigned to the validators after rounding.
  - `reconstruct_threshold_in_weights`: Any subset of validators whose weights sum is ≥ this value can always reveal the secret (randomness).

**Guarantees**. When validators are assigned with weights according to `validator_weights`, any subset of validators that have a weight sum `≥ reconstruct_threshold_in_weights` must have stake ratio in the range `(secrecy_threshold_in_stake_ratio, reconstruct_threshold_in_stake_ratio]`.

**Rationale**. Since in production `secrecy_threshold_in_stake_ratio` is `0.5` and `reconstruct_threshold_in_stake_ratio` is `0.66`, the subset of validators that can reveal the secret (randomness) must have a stake ratio in `(0.5, 0.66]`. Due to the Proof-of-Stake assumption where the adversary owns at most `1/3` of the stake, the adversary cannot reveal the secret by itself (since `1/3 < 0.5`), and the honest validators can always reveal the secret by themselves (since `2/3 > 0.66`).

### New transaction types

#### A new internal transaction type: `BlockMetadataExt`

The VUF evaluation of needs to be put on chain as the block randomness seed in the `BlockMetadata` transaction (always the 1st transction in a block).
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

#### A new validator transaction variant: `DKGResult`

A new validator transaction type `DKGResult` is needed to bring DKG transcripts on chain.

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

### Reconfiguration related changes

#### On-chain configuration refactoring

On-chain configurations are special on-chain resources that control validator component behaviors.
E.g. the consensus component reloads `ConsensusConfig` on new epoch start;
the block executor reloads `GasSchedule` and `Features` for every block.

Currently, on-chain config updates and initializations are done by modifying the on-chain resources directly then immediately an instant reconfiguration
(defined [here](#how-to-land-new-reconfiguration-mode-async-reconfiguration)).
This is to avoid the situation where a validator restarts and operates with the new config, while the others are on the old config.

To support both instant reconfiguration (when randomness is off) and async reconfiguration (when randomness is on),
the following changes are needed.

- For `config_x`, there should be a `config_x::set_for_next_epoch()` governance function to buffer updates, as well as a `config_x::on_new_epoch()` function to be invoked at epoch time to apply the updates.
  - It's recommended to implement the `set_for_next_epoch()` and `on_new_epoch()` in a way that supports both initialization and updates.
- The existing apply-and-reconfigure APIs (e.g., `consensus_config::set()`) should be disabled unless it is in genesis.
- The `aptos_governance::reconfigure()` function should invoke instant reconfiguration if randomness is off,
  or start async reconfiguration otherwise.

These changes allow the following config initialization/update pattern to work regardless of whether randomness is on/off.

```
config_x::set_for_next_epoch(&framework_signer, new_config);
aptos_governance::reconfigure(&framework_signer);
```

Some reference implementation points.

- Updated `ConsensusConfig` [here](https://github.com/aptos-labs/aptos-core/blob/be0ef975cee078cd7215b3aea346b2dhttps://github.com/aptos-labs/aptos-core/blob/f1d583760848c118afe88dda329105d67eea35a2/aptos-move/framework/aptos-framework/sources/configs/consensus_config.move#L52-L69).

#### Validator set locking during reconfiguration

While the buffers of most on-chain configs can keep accepting updates during DKG,
the validator set change buffer needs to be locked during reconiguration.
Otherwise, the voting power distribution and the VUF weight distribution may mismatch, which means the randomness is insecure.

This should be done by:

- introducing a global on-chain indicator of whether a reconfiguration is in progress;
- updating the indicator in reconfiguration operations.
- aborting any user transaction that may touch the next validator set, if any reconfiguration is in progress.

Some reference implementation points.

- The on-chain indicator [here](https://github.com/aptos-labs/aptos-core/blob/main/aptos-move/framework/aptos-framework/sources/reconfiguration_state.move).
- Updated public framework function `stake::leave_validator_set()` [here](https://github.com/aptos-labs/aptos-core/blob/59586fee4ebb88d659f0f74afa094d728cf32b5d/aptos-move/framework/aptos-framework/sources/stake.move#L1109).

#### New reconfiguration mode: async reconfiguration

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
- Off-chain process, where validators run DKG, one of them obtains a DKG transcript and proposes it as a transaction to trigger on-chain step 2.
  - Done in `DKGManager` as described in [this section](#how-to-land-dkgmanager-new-validator-component-to-execute-DKG).
- On-chain step 2, triggered once a DKG transcript is available.
  - Publish the DKG transcript on chain.
  - Update `ValidatorSet`.
  - Unlock the validator set change buffer.
  - Apply all the buffered on-chain config changes.
  - Increment the on-chain epoch counter.
  - Emit a `NewEpochEvent` to trigger epoch-swtiching operations in valdiators.

See the reference implementation [here](https://github.com/aptos-labs/aptos-core/blob/main/aptos-move/framework/aptos-framework/sources/reconfiguration_with_dkg.move).

### DKG related changes

#### New component: `DKGManager`

`DKGManager` is a new component that should run on every validator node to do the folowing.

- On `DKGStartEvent` triggered in the current epoch, run DKG with peers.
  - It means to deal a transcript for the next validator set, exchange it with peers, and obtain an aggregated transcript with more than 1/3 voting power.
- Once an aggregated transcript is obtained, wrap it as a `DKGResult` validator transaction and propose it into the validator transaction pool.
  - [Validator Transaction](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-64.md) is required to be enabled.
- On `NewEpochEvent`, recall any proposed `DKGResult` transactions.
- On crash restart, check the on-chain DKG state. If the DKG for the current epoch is in progress, participate in it.

Implementation note: as long as the eventually accepted DKG transcript can verify,
it is fine if validators equivocate on their transcripts or their local views of the aggregated transcript are different.
This can be utilized to implement `DKGManager` without persisting any state.

Reference implementation: https://github.com/aptos-labs/aptos-core/blob/df715afc2ca6646bcdee63e44e30c549ebe14bf3/dkg/src/dkg_manager/mod.rs#L51

#### Consensus changes

- When proposing new blocks, validators include `DKGResult` validator transactions.
  
  - [Reference implementation](https://github.com/aptos-labs/aptos-core/blob/1de391c3589cf2d07cb423a73c4a2a6caa299ebf/consensus/src/liveness/proposal_generator.rs#L384-L403).
    Come for free if [Validator Transaction](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-64.md) is enabled.

- When verifying a block proposal, validators reject it if a `DKGResult` validator transaction is present but randomness is disabled.
  
  - This is a required security practice discussed in [AIP-64](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-64.md#security-considerations).
  - [Reference implmementation](https://github.com/aptos-labs/aptos-core/blob/1de391c3589cf2d07cb423a73c4a2a6caa299ebf/consensus/src/round_manager.rs#L687-L691).

### Randomness generation related changes

#### New component: `RandManager`

A `RandManager` is needed between consensus and execution pipeline to attach per-block randomness seeds as follows.

- On epoch start tasks.
  - Decrypt VUF key shares from on-chain DKG transcript.
  - Extra work if required by the actual VUF schemes.
    - Generate augmented key pairs from VUF key shares.
    - Exchange the augmented pub-keys with peers, obtain a quorum-cert for its own augmented pub-keys.
    - Exchange the quorum-certified augmented pub-keys with peers, and persist them for crash recovery.
- Receive the stream of ordered blocks from consensus.
- Ensure every ordered block has randomness seed (i.e., the VUF evaludation of the block).
  - The VUF evaludation is obtained by exchanging VUF shares with peers, using its own augmented key pairs to sign and peers augmented public keys to verify.
- Forward the stream of randomness-ready blocks to the execution pipeline.

See reference implementation [here](https://github.com/aptos-labs/aptos-core/blob/1de391c3589cf2d07cb423a73c4a2a6caa299ebf/consensus/src/rand/rand_gen/rand_manager.rs#L50).

#### Execution pipeline changes

In execution pipeline, a randomness-ready block is processed into a transaction list,
where the first transaction needs to be a `BlockMetadataExt` transaction to carry the block randomness seed.

See reference implementation [here](https://github.com/aptos-labs/aptos-core/blob/1de391c3589cf2d07cb423a73c4a2a6caa299ebf/consensus/src/state_computer.rs#L203).

#### Move VM changes

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

- (a) Verify the aggregated DKG transcript included.
- Unlock the validator set resources.
- Apply all pending on-chain config changes.
- Publish DKG transcript on chain.
- Whatever is done in `BlockMetadata` transaction when epoch timeout is detected.

Malicious validators can cause step (a) to fail, in which case should cause the transaction to be discarded.
The remaining steps should never abort.
See the reference implementation [here](https://github.com/aptos-labs/aptos-core/blob/1de391c3589cf2d07cb423a73c4a2a6caa299ebf/aptos-move/aptos-vm/src/validator_txns/dkg.rs#L70).

### Test-and-abort attack preventions in VM

In a [test-and-abort attack](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-41.md#test-and-abort-attacks),
a dApp defines a public function for a user to:
1. toss a coin, then
2. get a reward if coin=1, or get a punishment otherwise.
A malicious user can write another contract to invoke this public function and abort if there was no reward,
and it will never receive punishments.

To prevent this attack, randomness API call hander should ensure the call originates from a **private entry function**.
(Reference implementation points
[1](https://github.com/aptos-labs/aptos-core/blob/e5d6d257eefdf9530ce6eb5129e2f6cbbbea8b88/aptos-move/aptos-vm/src/aptos_vm.rs#L806-L811)
[2](https://github.com/aptos-labs/aptos-core/blob/e5d6d257eefdf9530ce6eb5129e2f6cbbbea8b88/aptos-move/framework/aptos-framework/sources/randomness.move#L77)
.)

## Testing (Optional)

Unit tests, smoke tests, forge tests.

Deploy a test network called `randomnet` which lasts for several months.

Further stress / performance testing done in `previewnet`.

## Risks and Drawbacks

### Disaster Scenarios

**DKG loses liveness**. In case of implementation bugs/bad configurations, DKG may never finish, so the epoch change won't finish and buffered on-chain config updates won't be applied. Note that the chain is still live in this case, but the validators cannot advance to new epochs.  

*Mitigation*: Validators can force epoch change and disable randomness feature. A hotfix needs to be deployed for full mitigation after debugging.

**Randomness generation loses liveness**. If this happens, the blockchain will halt as every block needs randomness to proceed for execution.

*Mitigation*: Validators can disable randomness feature using local configuration overwrite and restart all validators to pause the randomness generation to bring the chain back alive as a temporary mitigation. A hotfix needs to be deployed for full mitigation after debugging. 

### Other Risks:

**MEV attacks**. When malicious validators control more than 50% (secrecy threshold) of the total stakes, there is a risk of malicious validators colluding together and leak the VUF secret key. If this happens, the colluding validators can predict all randomness in the current epoch.

### Drawbacks

**Performance impact**. The randomness generation phase adds small latency overhead in the block commit latency, due to cryptographic operations and communication delays. 

**Reconfiguration impact**. The DKG phase will affect the reconfiguration process. 
*On-chain configuration changes.* For periodic reconfigurations that happen every two hours, the validators need to finish the DKG before the next epoch starts. For governance proposals that require reconfiguration, the changes by the governance proposal will be buffered on-chain, and applied after the DKG finishes and validators enter the new epoch. Any future new on-chain configs need to follow the same procedure.
*Validator set changes.* In the current design, during the DKG phase any changes to the `ValidatorSet` will be rejected. Based on the latest mainnet simulation, it means for up to 30 secs in every 2 hours, transactions for validator set changes will fail. 

More details can be found in the Specification section.

**Constraints on validator set size**. If the validator set size is too large, in the worst case when the stake distribution is adversarial, the rounding algorithm will output DKG parameters with large total weight, causing the DKG transcript to exceed some transaction limits. When this happens, the DKG may lose liveness. 

Here are some related transaction limits. As a prevention, the DKG transaction size will be monitored closely and the corresponding alerts will be set properly. When the DKG transaction size is close to the limit, we may have to relax the transaction limits below. 

- `max_bytes_per_write_op`: limit of the size of a single state item, 1MB currently.
- `ValidatorTxnConfig::V1::per_block_limit_total_bytes`: limit of the total validator transaction size in one block, 2MB currently.

## Future Potential

The framework implemented in this AIP opens opportunities for future developments of threshold cryptography schemes on top of Aptos blockchain. For instance, a native threshold encryption scheme can be supported once the corresponding efficient cryptography building blocks are available. 

## Timeline

Targeting release v1.12.

## Security Considerations

The security assumption of on-chain randomness is the same as the blockchain security assumption, i.e., proof-of-stake. 

There are several potential attacks at the smart contract level that has been mitigated by this implementation. Details can be found in [AIP-41](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-41.md#security-considerations).

## References

[^aip-41]: https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-41.md

[^DPTX24e]: **Distributed Randomness using Weighted VUFs**, by Sourav Das and Benny Pinkas and Alin Tomescu and Zhuolun Xiang, 2024, [[URL]](https://eprint.iacr.org/2024/198)
