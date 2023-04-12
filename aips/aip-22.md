# AIP struct transaction arguments

# Summary

We enable the some structs as valid parameters to entry functions.

# Motivation

So far only primitive values can be passed into entry functions. Mainly because allowing generic structs as input would invalidate important invariants, like creating Coins out of nothing.

# Specification

- Entry functions can take a String as input parameter. This was already a special case and continues to be supported. The string is given as a vector<u8> which has to be valid utf8 otherwise the transaction validation will fail.
- Entry functions can take FixedPoint32, FixedPoint64 as input parameters. The value passed in is u64 or u128 respectively and represents the raw value of the fixed point value.
- Entry functions can take an Option<T> iff T is a valid type for an input parameter. The format is an empty vector for None and a singleton vector with element x for Some(x), where x is of type T. Vector of more than 1 element will be rejected on input validation.
- Entry functions can take Object<T> as input parameter. The format will be just the address of the object. The resource T must exist at said address otherwise input validation will fail.

# Reference Implementation

- The code to enable generic structs is merged in https://github.com/aptos-labs/aptos-core/pull/7090
