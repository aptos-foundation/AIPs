---
aip: 44
title: Module Events
author: lightmark
Status: Accepted
type: Standard (Core, Interface, Framework)
created: 07/20/2023
---

# AIP-44 - Module Events

## Summary

This AIP defines module-level event framework targeting to replace the current instance event framework. The new event framework associates every event stream with a static struct type instead of an `EventHandle` of instance event.

## Motivation

Events have become pretty widely used in various smart contracts to log when a significant action has occurred, instead of parsing the output of each transaction to understand what really happened semantically after the execution. But the instance event scheme was designed back to Libra/Diem time, which suffers a lot of issues with `EventHandle`:

- Require creation before usage
- Removal of the containing struct deletes the handle the lack of which makes the event history inaccessible from sdk.
- `EventHandle` is inaccessible in deeply nested data structure, not to mention if table is involved.
- Event sequence number degrades parallelization with few benefits to end users, if at all.
- `EventHandle` is partially identified with an address, which may not semantically expressive in some cases.
- The creation and deletion involves `signer` that complicates the module contract design.
- At storage level the only secondary indexing is not customizable.
- Data fragmentation due to event handles and events being everywhere in all accounts/objects.

The goal of module events is to solve all the aforementioned issues.

## Impact

All Aptos move developers will benefit from the module events and should start to adopt module events and deprecate instance events.

## Rationale

An alternative to unblock the parallelization with instance event seq num is to use an ungraded version of aggregator. However, the
change is not transparent to users either. Also, it fails to address other issues.

## Specification

At move smart contract level, module event would be identified as a `struct` type with `#[event]` attribute which will be evaluated by the extended type checker.

Module Event Example:

```rust
/// An example module event struct denotes a coin transfer.
#[event]
struct TransferEvent<Coin> has store, drop {
  sender: address,
  receiver: address,
  amount: u64
}
```

To emit event, a new native function `emit` (or whatever proper name) will be introduced in event module:

```rust
/// Emit an event with payload `msg` in event stream identified by T. T must have #[event] attribute.
public fun emit<T: store + drop>(event: T) {
write_to_module_event_store < T > (event);
}
```

At storage level, no new tables will be added as we will reuse the main event table.

```rust
//! table_event_data
//! |<------key------>|<------------value--------------->|
//! | version | index | event_type_tag | bcs_event_bytes |
```

At API level, new API endpoint will be introduced for module events. After indexer support, we will add new API for module events.

## Risks and Drawbacks

Instance events and module events have to coexist for a long time. A significant amount of work needs to be done to
promote module events over instance events.

## Future Potential

Aptos official indexer could support flexible indexing config to cater users' needs.

## Acknowledgement

Thanks to the individual contributors in this AIP’s [discussion](https://github.com/aptos-foundation/AIPs/issues/200).

## Timeline

### Suggested implementation timeline

By end of Q3

### Suggested developer platform support timeline

By end of Q3

### Suggested deployment timeline

v1.7

## Security Considerations

None
