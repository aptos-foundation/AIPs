---
aip: 18
title: Introducing SmartVector and SmartTable to aptos_std
author: lightmark
Status: Draft
type: Standard (Framework)
created: 03/07/2022
---

# AIP-18 - Introducing SmartVector and SmartTable to apto_std

## Summary

This AIP proposes to move two storage-efficient data structures into Aptos Framework. In general, those two structs can
lower the storage footprint by packing several elements into one storage slot instead of one per slot as what a normal
`Table` would do.

## Motivation

Move is not hard to learn. But the intricacies between Move and Infra are not that intuitive, such as how gas scheduling
work including storage and execution. Specifically, how the data structures in Move are stored in storage and how are
the data represented and what the layout looks like, are not well understood. Having Witnessed many misuses of `vector`
and `table`, our sequencing and associative container types, across various ecosystem projects on Aptos, we are pretty
aware due to the lack of understanding of our gas schedule including both execution and storage, most move developers on
Aptos are not able to write the most efficient smart contract code for gas optimization. This leads to:

1. Some projects complained that gas charged is more expensive than expected.
2. People abuse `Table`, which is what we try to disincentivize in the long run for small state storage.

So we plan to provide a one-size-fits-all solution for both `vector` and `table` data structures that can handle data
scaling issue in a more optimized way considering the storage model and gas schedule. Therefore, most developers do not
have to concern too much with gas cost between different choices of container types. Instead, they could focus more on
the product logic side.

## Rationale

The design principle is to put more data into one slot without significant write amplification.

- SmartVector would take as less slots as possible. Each slot could contain more than one element. When a predefined
  size of slot is reached, it would necessarily open a new slot to balance cost of bytes written and item creation.
- SmartTable would also pack as many key-value pairs into one slot as possible. While the slot exceeds a threshold, it
  should be able to grow one bucket at a time. In the meanwhile, the number of key-value pairs in each slot should not
  be too skewed.

## Specification

### SmartVector

#### Data Structure Specification

```move
struct SmartVector<T> has store {
inline_vec: vector<T>,
big_vec: Option<BigVector<T>>,
}
```

In a nutshell, `SmartVector` consists of an `Option<vector<T>>` and an `option<BigVector<T>>`, which is
a `TableWithLength<T>` with metadata inherently. It is noted that we use `vector` to replace `option` here to
avoid `drop` capability constraint on `T`.The idea is:

1. When the total size of data in the smart vector is relatively small, only `inline_vec` will have data and it stores
   all the data as a normal vector. At this time, smart vector is just a wrapper of normal vector.
2. When the number of elements in `inline_vec` reached a threshold(M), it will create a new `BigVector<T>`
   into `big_vec` with a bucket size(K) calculated based on the estimated average serialized size of `T`. Then all the
   following elements to push will be put into this `BigVector<T>`.

#### Interfaces

SmartVector implements most basic functions of `std::vector`.

It is noted that `remove`, `reverse` and `append` would be very costly in terms of storage fee because they all
involve a number of table items modification.

#### Determine default configurations

The current solution is using the `size_of_val`(T) of the current element to push multiplied by `len(inline_vec) +
1` , if it is greater than a hardcoded value, *150*, this new element will become the first element in `big_vec`, whose
bucket_size, `K`, is calculated by dividing a hardcoded value, *1024*, by the average serialized size of all the
elements in `inline_vec` and the element to push.

### SmartTable

#### Data Structure Specification

```move
/// SmartTable entry contains both the key and value.
struct Entry<K, V> has copy, drop, store {
hash: u64,
key: K,
value: V,
}

struct SmartTable<K, V> has store {
buckets: TableWithLength<u64, vector<Entry<K, V>>>,
num_buckets: u64,
// number of bits to represent num_buckets
level: u8,
// total number of items
size: u64,
// Split will be triggered when target load threshold is reached when adding a new entry. In percent.
split_load_threshold: u8,
// The target size of each bucket, which is NOT enforced so oversized buckets can exist.
target_bucket_size: u64,
}
```

`SmartTable` is basically a `TableWithLength` where key is a `u64` hash mod h(hash) of the user key and value is a
bucket, represented by a vector of all user key-value(kv) pairs with the same hashed user key. Compared to
native `Table`, it makes table slot more compact by packing several kv pairs into one slot instead of one per slot.

SmartTable internally adopt [linear hashing](https://en.wikipedia.org/wiki/Linear_hashing)(LH) algorithm which
implements a [hash table](https://en.wikipedia.org/wiki/Hash_table)
and grows one bucket at a time. In our proposal, each bucket take one slot, represented by `vector<Entry<K, V>>` in as
value type in a `TableWithLength`. LH serves well for the motivation because the goal is to minimize the number of slots
while maintaining a table-like structure dynamically.

There are two parameters determining the behavior of SmartTable.

- split_load_threshold: when a new kv pair is inserted, the current load factor will be calculated
  as `load_factor = 100% * size / (target_bucket_size * num_buckets)` .
    - If load_factor ≥ split_load_threshold, it means the current table is a bit bloated and needs a splitting.
    - Otherwise, no action is needed since the current number of buckets are good enough to hold all the data.
- target_bucket_size: The ideal number of kv pairs each bucket holds. It is noted that this is not enforced but only
  used as an input to calculating load factor. In reality, sometimes an individual bucket size could exceed this value.

#### Interfaces

SmartTable implements all the `std::table` functions.

#### Determine default configurations

- split_load_threshold: 75%
- target_bucket_size: `max(1, 1024 / max(1, size_of_val(first_entry_inserted)))`

The current heuristic to automatically calculate target_bucket_size if not specified, is dividing the free quota, 1024,
by the size of the first entry inserted into the table.

#### Linear Hashing(LH) in SmartTable

- LH stores kv pairs into buckets. Each bucket stores all the kv pairs having the same hash of their keys. In
  SmartTable, each bucket is represented as a `vector<Entry<K, V>>`. A potential followup is to replace it with
  a native ordered map.
- LH requires a family of hash functions. At any time, two functions are used in this family. SmartTable uses
  `h(key)=hash(key) mod 2^{level}`  and `H(key)=hash(key) mod 2^{level + 1}` as hash functions that the result is
  always an integer.
- level is an internal variable starting from 0. When 2^{level} buckets are created, level increments so `h(key)`
  and `H(key)` double their modulo base together. For example, previously h(key) = hash(key) % 2, and H(key) = hash
  (key) % 4. After level increments, h(key) = hash(key) % 4, and H(key) = hash(key) % 8.

##### Split

1. SmartTable starts with 1 bucket and level = 0. h(key) = hash(key)%1, H(key) = hash(key)%2. For each round of
   splitting, we start from bucket 0.
2. If splitting happens, the next bucket to split is incremental until reaching the last bucket of this level
   round, `2^level - 1`. When the last bucket is split, actually during this round we have split 2^level buckets,
   resulting in an additional 2^level buckets, in total the number of buckets is doubled. Then we increment level, and
   start another split round from 0 again. Correspondingly, h(key) and H(key) change by double their modulo base
   together.
3. The index of the bucket to split is always `num_buckets ^ (1 << level)` not the one we just inserted a kv pair
   into. `num_buckets % (1 << level)`
4. When splitting happens, all the entries in the split bucket will be redistributed between it and the new bucket
   using `H(key)`

##### Lookup

Lookup is tricky as we have to use both `h(key)` and `H(key)` for lookups. First we calculate `bucket_index = H(key)` if
the result is an index of an existing bucket, it means the `H(key)` actually works so we just use `bucket_index` to find
the right bucket. However, if the result is invalid for existing bucket, it means the corresponding bucket has not been
split yet. So we have to turn to `h(key)` to find the correct bucket.

## Reference Implementation

[smart_vector](https://github.com/aptos-labs/aptos-core/pull/5690) and
[smart_table](https://github.com/aptos-labs/aptos-core/pull/6339)

## Risks and Drawbacks

The potential drawbacks of these two data structures are:

1. No easy to index as each of them pack multiple entries into one slot/bucket.
2. For SmartTable, the gas saving may be not ideal for now for some operations since it does linear search for lookup
   and adding item may trigger bucket splitting and reshuffling.
3. The smart data structures are not well supported by indexer as it involves table with opaque internals.
4. Under the current gas schedule the gas cost may be much higher since we are re-charging the storage fee each time.
   But we are expecting a different gas schedule to be published soon when we’ll benchmarking the gas cost of smart data
   structures.

2 can be mitigated by using a native ordered map implementation as a bucket.

## Gas Saving

After the 100x execution gas reduction, the we benchmark the gas cost of creation and add 1 element into
vector/SmartVector/Table/SmartTable.

| gas units | creation with 10000 u64 elements | push a new element | read an existing element |
| --- | --- | --- | --- |
| vector | 4080900 | 3995700 | 2600 |
| smart vector | 5084900 | 2100 | 400 |

| gas units | creation with 1000 u64 kv pairs | add a new kv pair | read an existing kv |
| --- | --- | --- | --- |
| table | 50594900 | 50800 | 300 |
| smart table | 2043500 | 700 | 300 |

Reflected by the table above, smart data structures outperform vector and table for large datasets a lot in terms of
both creation and updates.

In a nutshell, we recommend using smart data structures for use cases involving large datasets such as whitelist. They
also can be easily destroyed if the internal elements have `drop`.

## Future Potential

- Currently, we use `size_of_val` to automatically determine the configurations of both data structures. If Move can
  support serialized size estimation natively, the cost of those operations could drop a lot.
- As mentioned before, bucket splitting incurring possibly reshuffling and linear scan when searching is costly when
  `vector` is used as a bucket. If there is a native `map` struct, the gas cost would be highly cut down.

## Suggested implementation timeline

Code complete: March 2023

## Suggested deployment timeline

Testnet release: March 2023