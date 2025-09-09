```yaml
aip: (this is determined by the AIP Manager, leave it empty when drafting)

title: Zaptos

author: Zekun Li, Zhuolun Xiang

discussions-to (*optional): <a url pointing to the official discussion thread>

Status: <Draft | Last Call | Accepted | Final | Rejected>

last-call-end-date (*optional): <mm/dd/yyyy the last date to leave feedbacks and reviews>

type: Core

created: 9/9/2025

updated (*optional): <mm/dd/yyyy>

requires (*optional): <AIP number(s)>
```

# AIP-X - Zaptos

## Summary

End-to-end blockchain latency, measured from the moment a transaction is submitted to the point of receiving confirmation that it has been committed, is crucial for the mass adoption of latency-sensitive blockchain applications, including payments, DeFi, and gaming.

To reduce end-to-end blockchain latency, this AIP implements Zaptos -- a novel parallel, pipelined blockchain architecture designed to minimize end-to-end latency while maintaining the high throughput of pipelined blockchains.

Zaptos shadows the block execution, state certification, and storage stages under the consensus latency in the common case.

This means that a block has already been executed, its final state has been certified and persisted, by the time the block is ordered.

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

> How will we solve the problem? Describe in detail precisely how this proposal should be implemented. Include proposed design principles that should be followed in implementing this feature. Make the proposal specific enough to allow others to build upon it and perhaps even derive competing implementations.

...

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

> This is an optional yet highly encouraged section where you may include an example of what you are seeking in this proposal. This can be in the form of code, diagrams, or even plain text. Ideally, we have a link to a living repository of code exemplifying the standard, or, for simpler cases, inline code.

...

New pipeline implementation:

https://github.com/aptos-labs/aptos-core/pull/15145

https://github.com/aptos-labs/aptos-core/pull/15164

Optimistic commit:

https://github.com/aptos-labs/aptos-core/pull/13604

Optimistic execution, certification piggybacking, skip randomness block: https://github.com/aptos-labs/aptos-core/pull/17310

## Testing (Optional)

> - What is the testing plan? (other than load testing, all tests should be part of the implementation details and won’t need to be called out)

> - When can we expect the results?

> - What are the test results and are they what we expected? If not, explain the gap.

...

## Risks and Drawbacks

> - Express here the potential negative ramifications of taking on this proposal. What are the hazards?

> - Any backwards compatibility issues we should be aware of?

> - If there are issues, how can we mitigate or resolve them?

...

## Future Potential

Once transaction deferring is implemented, Zaptos optimizations can be applied to non-randomness transactions which are included in a block that also contains randomness transactions.

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

> - On devnet?

> - On testnet?

> - On mainnet?

...

## Security Considerations

> - Does this result in a change of security assumptions or our threat model?

> - Any potential scams? What are the mitigation strategies?

> - Any security implications/considerations?

> - Any security design docs or auditing materials that can be shared?

## Open Questions (Optional)

> Q&A here, some of them can have answers some of those questions can be things we have not figured out but we should