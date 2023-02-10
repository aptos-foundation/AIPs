---
aip: 8
title: Higher-Order Inline Functions for Collections
author: wrwg
discussions-to: https://github.com/aptos-foundation/AIPs/issues/33
Status: Accepted
last-call-end-date: TBD
type: Standard (Framework)
created: 2023/1/9
updated: 2023/1/9
---

# AIP-8 - Higher-Order Inline Functions for Collections

## Summary

Recently, the concept of *inline functions* has been added to Aptos Move. Those functions are expanded at compile time and do not have an equivalent in the Move bytecode. This ability allows them to implement a feature which is currently not available for regular Move functions: taking functions, given as lambda expressions, as parameters. Given this, we can define popular higher-order functions like 'for_each', 'filter', 'map', and 'fold' for collection types in Move. In this AIP, we suggest a set of conventions for those functions.

## Motivation

It is well-known that higher order functions lead to more concise and correct code for collection types. They are widely popular today in mainstream languages, including Rust, TypeScript, Java, C++, and more.

## Rationale

Move has currently no traits which would allow to define an `Iterator` type which comprehends available functions across multiple collection types. Here, we want to establish at least a convention for naming and semantics of the most common of such functions. This allows framework writers to know which functions to provide, developers to remember which functions are available, and auditors to understand what they mean in the code.

## Specification

### Foreach

Each iterable collection SHOULD offer the following three functions (illustrated by the `vector<T>` type):

```move=
public inline fun for_each<T>(v: vector<T>, f: |T|);
public inline fun for_each_ref<T>(v: &vector<T>, f: |&T|);
public inline fun for_each_mut<T>(v: &mut vector<T>, f: |&mut T|);
```

Each of those functions iterates over the collection in the order specific to that collection. The first one consumes the collection, the second one allows to refer to the elements, and the last one to update the elements. Here is an example using `for_each_ref`:

```move=
fun sum(v: &vector<u64>): u64 {
  let r = 0;
  for_each_ref(v, |x| r = r + *x);
  r
}
```

### Fold, Map, and Filter

Each iterable collection SHOULD offer the following three functions which transpose into a new collection of the same or different type:

```move=
public inline fun fold<T, R>(v: vector<T>, init: R, f: |R,T|R ): R;
public inline fun map<T, S>(v: vector<T>, f: |T|S ): vector<S>;
public inline fun filter<T:drop>(v: vector<T>, p: |&T|bool) ): vector<T>;
```

To illustrate the semantics of the `fold` and the `map` function, we show the definition of the later in terms of the former:

```move=
public inline fun map<T, S>(v: vector<T>, f: |T|S): vector<S> {
    let result = vector<S>[];
    for_each(v, |elem| push_back(&mut result, f(elem)));
    result
}
```

### Effected Data Types in Aptos

Those data types in the Aptos frameworks should get the higher-order functions (TO BE COMPLETED):

- Move stdlib
    - vector
    - option
- Aptos stdlib
    - simple map
    - ?
- Aptos framework
    - ?
- Aptos tokens
    - property map
    - ?


### Notes

- It is recommended that collection types outside of the Aptos frameworks use the same conventions.
- Only collection types which are expected to be iterable in a single transaction should offer these functions. For example, tables are not such collections.
- Some collection types may diverge by adding less or more of those functions, depending on the type of the collection.

## Reference Implementation

TODO: link to the code in the framework at `main` once the PRs landed

## Risks and Drawbacks

None visible.

## Future Potential

- Parts of the Aptos framework can be rewritten to make them better auditable by removing low-level loops and replacing them by calls to higher-order functions.
- The Move Prover can benefit from these functions to avoid looplow-level which are one of the most challenging parts of working with the prover.
- In the future, function parameters may also be supported by the Move VM. Then this proposal simply generalizes such that higher-order functions on collections not necessarily need to be inline functions.

## Suggested implementation timeline

The Move compiler implementation became feature complete with [PR 822](https://github.com/move-language/move/pull/822). The remaining effort is small, so we expect to fit this into the very next release.
