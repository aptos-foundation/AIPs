```yaml
aip: 132

title: Zaptos - the latency optimal blockchain architecture

author: Zekun Li, Zhuolun Xiang

discussions-to (*optional): <a url pointing to the official discussion thread>

Status: Draft

last-call-end-date (*optional): <mm/dd/yyyy the last date to leave feedbacks and reviews>

type: Core

created: 9/9/2025

updated (*optional): <mm/dd/yyyy>

requires (*optional): <AIP number(s)>
```

# AIP-132 - Zaptos on Validators

## Summary

End-to-end blockchain latency, measured from the moment a transaction is submitted to the point of receiving confirmation that it has been committed, is crucial for the mass adoption of latency-sensitive blockchain applications, including payments, DeFi, and gaming.

To reduce end-to-end blockchain latency, this AIP implements [Zaptos](https://arxiv.org/abs/2501.10612) -- a novel parallel, pipelined blockchain architecture designed to minimize end-to-end latency while maintaining the high throughput of pipelined blockchains. 

Zaptos shadows the block execution, state certification, and storage stages under the consensus latency in the common case.

This means that a block has already been executed, its final state has been certified and persisted, by the time the block is ordered.

More information about Zaptos can be found in [blogpost](https://medium.com/aptoslabs/zaptos-reducing-blockchain-latency-to-the-absolute-minimum-ca69c5da5727) and [collaboration with YziLabs research](https://x.com/AptosLabs/status/1912659666242511096).

### Goals

- Reduce end-to-end latency by parallelizing the blockchain pipeline stages.
  
- Maintain the peak throughput via efficient pipelining.
  

### Out of Scope

- Consensus improvements (Zaptos is consensus-agnostic).
  
- Client-validator direct communication.
  
- Optimizing latency for blocks containing randomness transactions via transaction deferring.
  

## Impact

The validator end-to-end latency is expected to be reduced by approximately one network RTT (round-trip time) under medium to high load.

## Specification


Zaptos introduces three optimizations over the baseline Aptos pipeline:

1. **Optimistic Execution (opt-execution):** Execute blocks as soon as they are proposed, not after ordering.
  
2. **Optimistic Commit (opt-commit):** Persist states immediately after execution, before certification.
  
3. **Certification Piggybacking:** Validators attach execution certificates to consensus messages.
  

The result is that by the time consensus finalizes a block, execution, certification, and commit are already done in parallel. This reduces end-to-end latency to **consensus latency + minimal network overhead**.

Below is an illustration of the validator pipeline before and after Zaptos:

Baseline (sequential pipeline):

| -------------------- consensus --------------------|

[Proposal] --> [Block vote] --> [Order Vote] --> [Execution] --> [Certification] --> [Commit]

Zaptos (parallel pipeline):

| -------------------- consensus --------------------|

[Proposal] --> [Block vote] --> [Order Vote]

                   --> [Execution] --> [Certification]

                                               --> [Commit]

#### Practical Considerations

- Optimistic commit. To avoid the implementation complexity and overhead of commit rollback, in the current Zaptos implementation, the optimistic commit will wait for the consensus to finish. We consider this tradeoff acceptable since commit latency is not currently a bottleneck. A rollback mechanism will be introduced when commit latency emerges as a limiting factor.
  
- Randomness. Any transaction that requires on-chain randomness can only be executed after the randomness is available, and the randomness can only become available when the transaction or the block is ordered by consensus. Therefore, Zaptos does not work for randomness transactions. In the current Zaptos implementation, the pipeline will check whether a block contains randomness transactions, and only blocks without randomness transactions can be optimistically executed.
  

Therefore, the current Zaptos implementation leads to the following pipeline:

For blocks without randomness transactions:

| -------------------- consensus --------------------|

[Proposal] --> [Block vote] --> [Order Vote] --> [Commit]

                   --> [Execution] --> [Certification]

For blocks with randomness transactions:

| -------------------- consensus --------------------|

[Proposal] --> [Block vote] --> [Order Vote] --> [Execution] --> [Certification]

                                                                                                       --> [Commit]

#### Code Snippet

The following code snippet shows part of the pipeline implementation. It illustrates how Rust’s Future abstraction enables asynchronous, event-driven execution of tasks in the pipeline.

```rust
fn spawn_shared_fut<
    T: Send + Clone + 'static,
    F: Future<Output = TaskResult<T>> + Send + 'static,
>(
    f: F,
    abort_handles: Option<&mut Vec<AbortHandle>>,
) -> TaskFuture<T> {
    let join_handle = tokio::spawn(f);
    if let Some(handles) = abort_handles {
        handles.push(join_handle.abort_handle());
    }
    async move {
        match join_handle.await {
            Ok(Ok(res)) => Ok(res),
            ...
        }
    }
    .boxed()
    .shared()
}

fn build_internal(
        &self,
        parent: PipelineFutures,
        block: Arc<Block>,
        block_store_callback: Box<
            dyn FnOnce(WrappedLedgerInfo, LedgerInfoWithSignatures) + Send + Sync,
        >,
    ) -> (PipelineFutures, PipelineInputTx, Vec<AbortHandle>) {
        let mut abort_handles = vec![];
        let (tx, rx) = Self::channel(&mut abort_handles);
        let PipelineInputRx {
            qc_rx,
            rand_rx,
            order_vote_rx,
            order_proof_fut,
            commit_proof_fut,
        } = rx;

        let prepare_fut = spawn_shared_fut(
            Self::prepare(self.block_preparer.clone(), block.clone(), qc_rx),
            Some(&mut abort_handles),
        );
        let rand_check_fut = spawn_shared_fut(
            Self::rand_check(
                prepare_fut.clone(),
                parent.execute_fut.clone(),
                rand_rx,
                self.executor.clone(),
                block.clone(),
                self.is_randomness_enabled,
                self.rand_check_enabled,
                self.module_cache.clone(),
            ),
            Some(&mut abort_handles),
        );
        let execute_fut = spawn_shared_fut(
            Self::execute(
                prepare_fut.clone(),
                parent.execute_fut.clone(),
                rand_check_fut.clone(),
                self.executor.clone(),
                block.clone(),
                self.validators.clone(),
                self.block_executor_onchain_config.clone(),
                self.persisted_auxiliary_info_version,
            ),
            None,
        );
        ...
        let all_fut = PipelineFutures {
            prepare_fut,
            rand_check_fut,
            execute_fut,
            ...
        };
        tokio::spawn(Self::monitor(
            block.epoch(),
            block.round(),
            block.id(),
            all_fut.clone(),
        ));
        (all_fut, tx, abort_handles)
    }
```

## Reference Implementation

New pipeline implementation:

https://github.com/aptos-labs/aptos-core/pull/15145

https://github.com/aptos-labs/aptos-core/pull/15164

Optimistic commit:

https://github.com/aptos-labs/aptos-core/pull/13604

Optimistic execution, certification piggybacking, skip randomness block: https://github.com/aptos-labs/aptos-core/pull/17310

## Testing (Optional)

The feature is gated via on-chian consensus config, and enabled on devnet since 1.36 and all forge environments.

Manual tests on devnet with randomness is also performed to verify the correctness of the implementation, simulation is patched with a local random seed in https://github.com/aptos-labs/aptos-core/pull/17576.

Performance Comparison with forge test

Before:

Load (TPS)                     | latency      | order->commit 
10                             | 0.420        | 0.062         
100                            | 0.450        | 0.064         
1000                           | 0.468        | 0.076         
3000                           | 0.492        | 0.087         
5000                           | 0.574        | 0.148         

After

Load (TPS)                     | latency      | order->commit 
10                             | 0.379        | 0.008         
100                            | 0.385        | 0.008         
1000                           | 0.395        | 0.009         
3000                           | 0.443        | 0.013         
5000                           | 0.484        | 0.023         

We can see that the end-to-end latency is reduced by around 50ms to 100s as expected with ~50ms one hop network latency, and mainly coming from order->commit latency being reduced by the pipeline.

## Risks and Drawbacks

The main risk of the implementation is the randomness transaction handling. If a block contains randomness transactions, it cannot be optimistically executed, all nodes need to agree on whether a block contains randomness transactions or not, otherwise it may lead to state divergence.
The plan is to add a consistency check locally to compare if the result matches the actual execution for one release before enabling the feature on mainnet.

Another risk of performance wins is if randomness transactions are frequent, the performance gain will be limited. With increasing block time, the percentage of blocks with randomness transactions is expected to be low. If we observe a high percentage of randomness blocks, we may consider deferring randomness transactions to the next block.

## Future Potential

Once transaction deferring is implemented, Zaptos optimizations can be applied to non-randomness transactions which are included in a block that also contains randomness transactions.

Fullnode doesn't support optimistic execution and commit, it only starts execution after ordering. if we implement optimistic execution we can further reduce the end-to-end latency.

## Timeline

### Suggested deployment timeline

- Release 1.36
  - Enable on forge and smoke tests environments
  - Running with consistency check on devnet/testnet/mainnet
- Release 1.37
  - Enable on devnet/testnet/mainnet