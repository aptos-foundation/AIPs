---
aip: 4
title: Update Simple Map To Save Gas
author: areshand
discussions-to: https://github.com/aptos-foundation/AIPs/issues/15
Status: Draft
last-call-end-date (*optional):
type: Standard (framework)
created: 12/8/2022
---
## Summary

Change the internal implementation of SimpleMap in order to reduce gas prices with minimal impact on Move and Public APIs.

## Motivation

The current implementation of SimpleMap uses a BCS-based logarithmic comparator identifying slots on where to store data in a Vector. Unfortunately this is substantially more expensive than a trivial linear implementation, because each comparison requires BCS serialization followed by a comparison. The conversion to BCS cannot be resolved as quickly as traditional comparator can and substantially impacts gas prices.

## Proposal

- Replace the internal definition of `find` from the current logarithmic implementation to a linear search across the vector.
- Replace the functionality within `add` to call `vector::push_back` and append new values instead of inserting them into their sorted position.

## Rationale

This will result in the following performance differences:

| Operation | Gas Unit Before | Gas Unit After | Delta |
| --- | --- | --- | --- |
| CreateCollection | 174200 | 174200 |  |
| CreateTokenFirstTime | 384800 | 384800 |  |
| MintToken | 117100 | 117100 |  |
| MutateToken | 249200 | 249200 |  |
| MutateTokenAdd10NewProperties | 1148700 | 390700 | 64% |
| MutateTokenMutate10ExistingProperties | 1698300 | 411200 | 75% |
| MutateTokenAdd90NewProperties | 20791800 | 10031700 | 51% |
| MutateTokenMutate100ExistingProperties | 27184500 | 10215200 | 62% |
| MutateTokenAdd300NewProperties (100 existing, 300 new) | 126269000 | 135417900 | -7% |
| MutateTokenMutate400ExistingProperties | 143254200 | 136036800 | 5% |

When the token only has 1 property on-chain, we can see the mutation token cost doesn’t change. However,

if the user wants to add 10 new properties or update existing properties, the gas cost is reduced by **64% and 75%.**

if the user wants to store 100 properties on-chain, the gas cost is reduced by 51% and 62%.

600 property mutations were also tested, but failed due to exceeding maximum gas.

## Implementation

Draft benchmark PR https://github.com/aptos-labs/aptos-core/pull/5765/files

```rust
// Before the proposed change
public fun add<Key: store, Value: store>(
        map: &mut SimpleMap<Key, Value>,
        key: Key,
        value: Value,
  ) {
      let (maybe_idx, maybe_placement) = find(map, &key);
      assert!(option::is_none(&maybe_idx), error::invalid_argument(EKEY_ALREADY_EXISTS));

      // Append to the end and then swap elements until the list is ordered again
      vector::push_back(&mut map.data, Element { key, value });

      let placement = option::extract(&mut maybe_placement);
      let end = vector::length(&map.data) - 1;
      while (placement < end) {
          vector::swap(&mut map.data, placement, end);
          placement = placement + 1;
      };
 }
// After the change
public fun add<Key: store, Value: store>(
    map: &mut SimpleMap<Key, Value>,
    key: Key,
    value: Value,
) {
    let maybe_idx = find_element(map, &key);
    assert!(option::is_none(&maybe_idx), error::invalid_argument(EKEY_ALREADY_EXISTS));

    vector::push_back(&mut map.data, Element { key, value });
}
```

```rust
// Before the proposed change
fun find<Key: store, Value: store>(
    map: &SimpleMap<Key, Value>,
    key: &Key,
): (option::Option<u64>, option::Option<u64>) {
    let length = vector::length(&map.data);

    if (length == 0) {
        return (option::none(), option::some(0))
    };

    let left = 0;
    let right = length;

    while (left != right) {
        let mid = left + (right - left) / 2;
        let potential_key = &vector::borrow(&map.data, mid).key;
        if (comparator::is_smaller_than(&comparator::compare(potential_key, key))) {
            left = mid + 1;
        } else {
            right = mid;
        };
    };

    if (left != length && key == &vector::borrow(&map.data, left).key) {
        (option::some(left), option::none())
    } else {
        (option::none(), option::some(left))
    }
}

// After the change
fun find_element<Key: store, Value: store>(
    map: &SimpleMap<Key, Value>,
    key: &Key,
): option::Option<u64>{
    let leng = vector::length(&map.data);
    let i = 0;
    while (i < leng) {
        let element = vector::borrow(&map.data, i);
        if (&element.key == key){
            return option::some(i)
        };
      i = i + 1;
    };
    option::none<u64>()
}
```

## **Risks and Drawbacks**

The internal representation for two SimpleMaps generated before and after the change will be different. For example, assuming a set of `{c: 1, b: 2, a: 3}` . The behavior before would create a set with an internal vector of the following: `{a: 3, b: 2, c: 1}` . After this change, it will be stored as `{c: 1, b: 2, a: 3}` . This results in two forms of breaking changes:

- Within Move, a SimpleMap’s equality property changes.
- As a client, the internal layout for SimpleMap changes.

The impact of these risks is relatively limited from our knowledge. Using a SimpleMap for equality is an esoteric application that the team has yet to see in the wild. The layout of SimpleMap is not considered at either the API layer or any of the AptosLabs SDKs.

We also see a performance drop for a very large simple_map once there are over 400 properties on-chain.

**Timeline**

TBD