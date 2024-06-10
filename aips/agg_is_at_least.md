---
aip: X
title: Introduce native API to evaluate aggregator value is greater or equal to given amount
author: igor-aptos
discussions-to (*optional): <a url pointing to the official discussion thread>
Status: Draft
last-call-end-date (*optional): <mm/dd/yyyy the last date to leave feedbacks and reviews>
type: Standard (Framework)
created: <mm/dd/yyyy>
updated (*optional): <mm/dd/yyyy>
requires (*optional): <AIP number(s)>
---

# AIP-X - Introduce native API to evaluate aggregator value is greater or equal to given amount

## Summary

Adding efficient and parallel-friendly way to check if value in an aggregator is greater than a given limit.

# High-level Overview

Calling aggregator_v2::is_at_least API, returns true if aggregator value is larger than or equal to the given `min_amount`, false otherwise.

Aggregators are concurrent counters, allowing for modification without introducing read/write conflicts.
Revealing the actual value (read) introduces the read-write conflict back, but in cases where we need to reveal a
property on the value - that can be done so efficiently and in a parallel friendly way, via existing branch prediction.
And so this operation is more efficient and much more parallelization friendly than calling `read(agg) > min_amount`.

## Impact

Allows for checking of minimal balance in FA, checking whether milestone is reached on a global counter, among other things, in a parallel friendly way.

Example usage shown in an [Counter with milestone](https://github.com/aptos-labs/aptos-core/blob/main/aptos-move/move-examples/aggregator_examples/sources/counter_with_milestone.move) example.

## Alternatives

Similar functionality can be achieved by combaining `try_sub` and `add`:

```
fun is_at_least<IntElement>(aggregator: &mut Aggregator<IntElement>, min_amount: IntElement): bool {
  if (aggregator_v2::try_sub(&mut agg, min_amount)) {
    aggregator_v2::add(&mut agg, min_amount);
    true
  } else {
    false 
  }
}
```

But that is less efficient / costs more gas, as well as mutates the aggregator to reveal the needed information. 

## Reference Implementation

- [https://github.com/aptos-labs/aptos-core/pull/13246](Add aggregator_v2::is_at_least API)

## Testing (Optional)

Performance is measured via single-node-performance benchmarks on CI, over a provided [move example](https://github.com/aptos-labs/aptos-core/pull/13527)

## Risks and Drawbacks

## Security Considerations

None, provides the same functionality as before, just more efficiently

## Future Potential

Once traits are deployed, `is_at_most`/`is_equal` utility methods will be provided as well. Until then, they can be derived from this one (assuming +1 doesn't overflow):
 - for `is_at_most(agg, max_amount)`, you can do `!is_at_least(max_amount + 1)`
 - for `is_equal(agg, value)`, you can do `is_at_least(value) && !is_at_least(value + 1)`

## Timeline

Targetted to be part of 1.14 release
