---
aip: AIP-47
title: Aggregators V2
author: georgemitenkov (https://github.com/georgemitenkov), vusirikala (https://github.com/vusirikala), gelash (https://github.com/gelash), igor-aptos (https://github.com/igor-aptos)
discussions-to (*optional): https://github.com/aptos-foundation/AIPs/issues/226
Status: In Review
last-call-end-date (*optional): <mm/dd/yyyy the last date to leave feedbacks and reviews>
type: Standard (Core/Framework)
created: 08/09/2023
updated (*optional): 
requires (*optional): 
---

# AIP-47 - Aggregators V2

## Summary

This AIP revamps and expands upon the current concept of Aggregators (which are efficient concurrent counters). In addition to the current parallelism, these actions will not be requiring sequential execution any more when:
- using aggregators for control flow (for example having transaction do an action if incrementing a counter doesn't exceed a limit)
- storing values from aggregators elsewhere (through AggregatorSnapshot concept)

## Motivation

If we look at the example code below:

```
let a = borrow_global_mut<A>(shared_addr1);
a.value += 1;                                  <-  concurrently changed often
move_to(signer, B {value: a.value});           <-  used for write only
```

If we call that code from multiple transactions, they all need to be executed one after the other,
because above does a read and a write to a.value, and so each two transactions would generate a read/write conflict. 
This basically limits transactions using the code above to a single-threaded performance.

Aggregators and AggregatorSnapshots exploit the observation that some variables that get concurrently changed often,
commonly don’t affect the rest of the computation, 
and can be computed with a placeholder value during transaction execution by the VM, 
and can instead be modified in place with an actual value in the post-processing stage, once the counter value is known.

Aggregator represents a value that is being frequently changed, and AggregatorSnapshot represents a value that depends on an Aggregator value at particular time.
Above code would be translated into a code that can be executed in parallel:

```
let a = borrow_global_mut<A>(shared_addr1);
aggregator_v2::add(a.value, 1);                                       <-  concurrently changed often
move_to(signer, B {value: aggregator_v2::snapshot(a.value)});     <-  used for write only
```

In case value is needed for execution flow or something more complex, we can either:
- compute it on the spot (and give up on the parallelism benefits for that transaction).
    - this is provided via `aggregator_v2::read` and `aggregator_v2::read_snapshot` functions
- or provide expected value and speculatively execute, and later re-execute (with invalidating later transactions), if materialization sees that a different value should’ve been used
    - because it is unlikely we can estimate actual Aggregator.value, we support this only for “boolean” results - i.e. whether Aggregator modification can be applied or exceeds the limits. This is provided via `aggregator_v2::try_add` function

## Impact

Which audiences are impacted by this change? What type of action does the audience need to take?

## Rationale

Explain why you submitted this proposal specifically over alternative solutions. Why is this the best possible outcome?

## Specification

### High Level implementation

Module structs and function signatures:
```
module aptos_framework::aggregator_v2 {
   struct Aggregator<IntElement> has store {
      value: IntElement,
      max_value: IntElement,
   }
   struct AggregatorSnapshot<IntElement> has store {
      value: IntElement,
   }
   struct DerivedStringSnapshot has store, drop {
      value: String,
      padding: vector<u8>,
   }

   public native fun try_add(aggregator: &mut Aggregator<IntElement>, value: IntElement): bool;

   public native fun read(aggregator: &Aggregator<IntElement>): IntElement;

   public native fun snapshot(aggregator: &Aggregator<IntElement>): AggregatorSnapshot<IntElement>;
   
   public native fun read_snapshot<IntElement>(aggregator_snapshot: &AggregatorSnapshot<IntElement>): IntElement;

   public native fun derive_string_concat<IntElement>(before: String, snapshot: &AggregatorSnapshot<IntElement>, after: String): DerivedStringSnapshot;

   public native fun read_derived_string(snapshot: &DerivedStringSnapshot): String;
}
```

Modification/write paths are efficient, read paths are expensive. 
That means that `try_add`, `snapshot` and `derive_string_concat` are efficient (except when `try_add` returns a different value from the last time it was called), 
while `read`/`read_snapshot` sequentialize the workload if called close to a modification. 
Note, that means that `read_snapshot`/`read_derived_string` are generally cheap if done not too close to `snapshot`/`derive_string_concat` calls that created them (i.e. not in the same transction).

#### Flow
- we execute set of transactions at a time (block at a time in consensus, chunk during state-sync). We create a new BlockSTM/MVHashMap for each execution, and Aggregator handling lives within that scope
- whenever we are reading from storage (i.e. MVHashMap doesn’t have data, and needs to fetch it from storage), we take all Aggregators/AggregatorsSnapshots in the resource, store their values from storage as their initial values, give them unique ID, and replace their value field with that unique ID. Inside of VM, `value` field now becomes `ValueImpl::DelayedFieldID`, and it is like a reference - it is an identifier, and actual value is lifted out.
- Modifications to Aggregator go in the VMChangeSet as a separate key - EphemeralId, instead of StateKey representing resource that contains it. And so changes to the actual value are not conflicts.
- BlockSTM speculatively executes transactions, and tracks what values it explicitly provided to each transaction (whether through aggregator::read or bool via aggregator::try_add). If values it provided don’t match with final values - BlockSTM invalidates execution, and requires re-running it.
- in the final pass, when BlockSTM creates transaction outputs, it replaces unique ID inside `value` field with an actual value
- In order to make sure gas charges are done correctly, every DelayedField has a fixed width (length of it's byte representation when serializing) - both when it is actual value, as well as when it is `ValueImpl::DelayedFieldID`. For that purpose, String fields - that have variable legnth, are put inside `DerivedStringSnapshot`, which has additional padding field - to guarantee fixed width. `DelayedFieldID` consits of both `unique_index` and it's fixed `width`.

### Implementation details

#### Identifiers

We want Aggregators to be inlined in the resources that use them in storage, but want them to have the indirection during execution and for write conflicts. So we want to treat Aggregators `value` field as a reference to an ephemeral location. 

We do that by having duality for the `value` field - in storage and on chain transaction output, it represents the actual value. Within the execution - in MVHashMap and within VM, it always represents an EphemeralIDs (u64), that is unique during the single block/chunk execution. 

Generating EphemeralIDs: we need ephemeral IDs to be unique during the single block/chunk execution. But EphemeralIDs really are ephemeral - they don’t need to be assigned deterministically - i.e. each validator can assign different ephemeral ID to the same Aggregator within the same block, and they will still be guaranteed to produce the transaction outputs. We are generating them via `generate_id()` function, whenever needed, through a single `AtomicU32` counter - accessed both when Aggregator is read from storage, as well as when we create a new Aggregator within a transaction.

Replacing value with EphemeralID: for all data read from storage, we need to replace it with ephemeral id, before passing it to the VM, and storing an original value - to be able to access it during execution. We are going to be doing that inside of MVHashMap, when it sees that it needs to fetch a data from storage, and before caching it in the MVHashMap or returning it to the VM.

Replacing EphemeralID with value: when BlockSTM is materializing the transaction and right before generating transaction output, we will replace them all in the write set, as well as from the read set - if this transaction modified that Aggregator 

Mechanics of replacing: We have vec<u8> at that point, and we need to replace it inline. So we need to deserialize, traverse and replace, and then serialize back. Since deserialization and serialization does the traversing, we’ve added a way to hook into them, and do the exchange during their traversal. We’ve added a new enum value into MoveTypeLayout - Marked that wraps the original type, and a way to pass into serialization/deserialization a method to call on Marked values. We implement an exchange function, which stores the original value, and puts the replacement inside. For the flow of replacing value with EphemeralIDs we do deserialize_with_marked() → serialize(), and for replacing EphemeralID with value we do deserialize() → serialize_with_marked().

Caveats: we need to be able to do the replacement for all Aggregators, no matter where they are stored - including tables and resource groups. For ResourceGroups in specific, we need to be able to do the replacement in the doubly-nested serialization. We are planning to do so, by moving the splitting into ResourceGroups from the adapter to the MVHashMap, so that each element of the ResourceGroup is represented as a separate item, and can be transformed independently. As an added benefit, that will remove read/write conflicts between fields of different Resources in the ResourceGroup, as well VMChangeSet producing smaller blobs (i.e. just Resources being touched in ResourceGroup and full blob only in the final transaction output).

#### Aggregator WriteOp and conflict definition

Aggregator value accesses and changes will be tracked on a separate path - i.e. EphemeralID (to distinguish from StateKey - as they will never be stored under that path in storage). And they will have slightly different logic throughput, similarly how modules will have slightly different logic, and so we will Modify VMChangeSet and MVHashMap to separately track data, module and aggregator information.

Aggregator Writes are different from regular writes - they have different logic on when there is a conflict and need to be re-executed. Aggregators modifications affect transactions in two ways - values that need to be inserted at the end, and in the control flow from the result of try_add/try_sub. Former we don’t need to worry about, for latter we need to know if execution was correct - or we need to re-execute.

We are going to take a cheap and speculative aggregator value, to use for transaction execution, for deciding on which values to return for try_add/try_sub, and we will track for which range of input values would the same results be returned, and then later once we know a correct aggregator value - know if transaction needs to be re-executed, or just patching the values is enough. 

Write on an aggregator can either be a Set(value) or Delta(value). Read constraints will be:

```
struct AggregatorReadConstraints {
  read: u128,
  is_explicit_read: bool,
  min_overflow_delta: u128,
  max_achieved_delta: u128,
  min_achieved_neg_delta: u128, 
  max_underflow_neg_delta: u128,
}
```

We can validate, if given a new value for an aggregator that is different from `read`, if transaction is still valid via:

```
new_read + min_overflow > aggregator.limit &&
new_read + max_achieved <= aggregator.limit &&
new_read >= min_achieved_neg_delta &&
new_read < max_underflow_neg_delta 
```

Basically, instead of there being a read/write conflict on every write, we have a read/write conflict only if a value that is read is different enough - for check above to return false.

Write operation and read constraints are aggregatable and associative, so in MVHashMap, we don’t need to update with new value, and re-update all other values at versions after it, we can just keep the first value, and write operation and read constraints for the other versions, and dynamically aggregate them when aggregator_v2::read is called. 

With that in mind, we can implement aggregators with: 

- during execution - accessing of the aggregator computes value at that version
- validation check the conflicts above against the computed value at that version, with the above rules
  
And no additional changes needed to BlockSTM. But this might be inefficient - dynamically computing a value and aggregating deltas is expensive, and so we will do these things to start with (but will test and iterate other options):

- accessing of value (except for explicit read) during execution is not going to aggregate deltas, but take the most recent fully computed value to the version we are looking for (which will be most recently committed version)
- we are also going to use a cheaper way to compute value at validation, making it such that validation passing doesn’t guarantee no re-execution needed
- we are going to add/reuse rolling commit stage to do final validation, as well as compute the most recently “fully materialized value” of the aggregator for above cheap accesses to use

#### AggregatorSnapshot

AggregatorSnapshot needs to link to a particular point for the Aggregator, so internal implementation of deferred_read() is going to be 1) cloning of an Aggregator (creating an Aggregator that only exists in memory, but has the delta history and everything, but cannot be modified further), and creating an AggregatorSnapshot that links to that aggregator. 
For now, we will not expose cloning of the Aggregator, so the link for computing value and tracking history can be only 1 level deep.

## Reference Implementation

- API in [aggregator_v2.move](https://github.com/aptos-labs/aptos-core/blob/main/aptos-move/framework/aptos-framework/sources/aggregator_v2/aggregator_v2.move)
- Implementation of native functions in [aggregator_v2.rs](https://github.com/aptos-labs/aptos-core/blob/main/aptos-move/framework/src/natives/aggregator_natives/aggregator_v2.rs) and extension/context in [delayed_field_extension.rs](https://github.com/aptos-labs/aptos-core/blob/main/aptos-move/aptos-aggregator/src/delayed_field_extension.rs). Full implementation of fallback (non-concurrent) implementation of aggregators V2 is in the first file.
- DelayedFieldID in [delayed_field_id.rs](https://github.com/aptos-labs/aptos-core/blob/main/third_party/move/move-vm/types/src/delayed_values/delayed_field_id.rs)
- implementation of TDelayedFieldView interface in [view.rs](https://github.com/aptos-labs/aptos-core/blob/main/aptos-move/block-executor/src/view.rs), which tracks `CapturedReads.delayed_field_reads` in [captured_reads.rs](https://github.com/aptos-labs/aptos-core/blob/main/aptos-move/block-executor/src/captured_reads.rs)
- BlockSTM handles validation and materialization in [executor.rs](https://github.com/aptos-labs/aptos-core/blob/main/aptos-move/block-executor/src/executor.rs) and stores versioned values in [versioned_delayed_fields.rs](https://github.com/aptos-labs/aptos-core/blob/main/aptos-move/mvhashmap/src/versioned_delayed_fields.rs)
- Logic to split Resource Groups inside of VMChangeSet is in [resource_group_adapter.rs](https://github.com/aptos-labs/aptos-core/blob/7b5cf257d6546e394ddd761f332df7b712bacd19/aptos-move/aptos-vm-types/src/resource_group_adapter.rs)
- end to end tests are in [aggregator_v2.rs](https://github.com/aptos-labs/aptos-core/blob/7b5cf257d6546e394ddd761f332df7b712bacd19/aptos-move/e2e-move-tests/src/tests/aggregator_v2.rs) 

These are the feature flags:
* API is gated by AGGREGATOR_V2_API
* Resource Groups split is gated by RESOURCE_GROUPS_SPLIT_IN_VM_CHANGE_SET
* Handling AggregatorsV2 in a delayed and concurrent way is gated by AGGREGATOR_V2_DELAYED_FIELDS 

## Risks and Drawbacks

It adds complexity, which will need to be maintained. Most of the complexity is encapsulated in the AggregatorContext and BlockSTM/MVHashMap, the rest are called out explicitly in the implementation details.

## Future Potential

This builds a path towards explointing the same observation (that some variables that get concurrently changed often, 
commonly don’t affect the rest of the computation) for other more complicated types - like string formatting snapshots, other collections - like sets, etc. This can increase parallelism that can be achieved on the real and complicated workloads.

## Timeline

Tentatively targetted for aptos-release-v1.10

### Suggested implementation timeline

Full implementation has been completed, together with a suite of tests

### Suggested developer platform support timeline

This simplifies external support of aggregator values (compared to V1), as values are stored inline in the resources themselves.

Values that depend on aggregators - now have a layer of indiraction - `AggregatorSnapshot`. We will have to appropriately work on this for usages of aggregators, i.e. in AIP-43, etc.

We will also add more documentation/learning resources on how to use Aggregators correctly.

### Suggested deployment timeline

Tentatively with aptos-release-v1.10

## Security Considerations

Main security consideration here is correctness of execution and determinism. Design components have been reviewed, and we are looking at extensive testing.

## Testing (optional)

Extensive unit and e2e tests, as well as benchmarks to validate performance improvements, and comparisons to naive approaches. Performance tests are included in the single_node_performance.py regression benchmark suite.
