# AIP move library

# Summary

We enhanced the libraries with FixedPoint64 support, extra math functions, string formatting and extra inline functions.

# Motivation

To facilitate move developers with a more comprehensive standard library.

# Specification

- Add FixedPoint64 as a more precise counterpart to FixedPoint32, with 18 digits precision and covering numbers between 0 and 10^18.
- Add sqrt, exp, log, log2, floor_log2, mul_div to the library as standard functions.
- Add additional inline functions for standard algorithms to the vector library. Namely for_each_reverse, rotate, partition, foldr, stable_partition and trim.
- Add upsert to simple table allowing to update existing keys or insert new key.
- Add formatting routines string_utils module. We have to_string(value) to convert a value into a human readable string and formatX(fmt, val1, val2, ..) for a rust-like string formatting.

# Reference Implementation

- FixedPoint64 https://github.com/aptos-labs/aptos-core/pull/7074
- Math lib https://github.com/aptos-labs/aptos-core/pull/6714/
- Inline functions https://github.com/aptos-labs/aptos-core/pull/6882
- Upsert https://github.com/aptos-labs/aptos-core/pull/6860
