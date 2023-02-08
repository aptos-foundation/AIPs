---
aip: TBD
title: New cryptography natives for hashing and MultiEd25519 PK validation
author: Alin Tomescu <alin@aptoslabs.com>
discussions-to (*optional): https://github.com/aptos-foundation/AIPs/issues/57
Status: Draft # | Last Call | Accepted | Final | Rejected
last-call-end-date (*optional):
type: Standard Framework # <Standard (Core, Networking, Interface, Application, Framework) | Informational | Process>
created: 02/02/2022
updated (*optional):
requires (*optional):
---

# AIP TBD - New cryptography natives for hashing and MultiEd25519 PK validation

## Summary

This is a bundle of 3 intended changes:

 - add support for computing the [Blake2b-256 hash function](https://github.com/aptos-labs/aptos-core/pull/5436) in Move smart contracts
 - add support for computing [SHA2-512, SHA3-512 and RIPEMD-160 hash functions](https://github.com/aptos-labs/aptos-core/pull/4181) in Move smart contracts
 - upgraded [MultiEd25519 PK validation](https://github.com/aptos-labs/aptos-core/pull/5822) to V2 address a bug where a PK with 0 sub-PKs would've been considered valid by our 
   - deprecates `0x1::multi_ed25519::public_key_validate` API
   - deprecates `0x1::multi_ed25519::new_validated_public_key_from_bytes` API
   - introduces `0x1::multi_ed25519::public_key_validate_v2` API
   - introduces `0x1::multi_ed25519::new_validated_public_key_from_bytes_v2` API


## Motivation

### Hashing

Support for the new hash functions will be useful when building bridges to other chains.
For example, computing Bitcoin addresses requires evaluating a RIPEMD-160 hash (see [here](https://en.bitcoin.it/wiki/Protocol_documentation#Addresses)).
If we do not accept this proposal, building bridges to other chains (as well other cryptographic applications) will be costly gas-wise, as per conversations with companies like Composable.Finance.

### MultiEd25519 V2 PK validation

The PK validation bug would've broken the type safety of our `0x1::multi_ed25519::ValidatedPublicKey` struct type, which is supposed to guaranteed that a PK is well-formed which among, other things, requires that the # of sub-PKs be greater than 0.

While such ill-formed `0x1::multi_ed25519::ValidatedPublicKey` structs would have **NOT** created any security issues during multisignature verification, since they are easily dismissed when used to verify a signature (i.e., via `0x1::multi_ed25519::signature_verify_strict`), they would have forced developers to think about the consequences of using such ill-formed PKs throughout their Move modules, increasing cognitive overload. 

If we do not accept this proposal, it could be possible for users to mis-use `0x1::multi_ed25519::ValidatedPublicKey` structs and create other security issues. 
For example, the non-repudiation property of a signature could be broken as follows.
Consider a contract that (1) manually de-serializes such a struct, (2) parses all the sub-PKs, (re)implements its own signature validation logic to check:

```
// Constructs an ill-formed n-out-of-n PK from evil bytes
let ill_formed_validated_pk = multi_ed25519::new_validated_public_key_from_bytes(evil_bytes);

let sub_sigs = vector<vector<u8>> = /* some signatures */;

// Deserializes such a PK, implicitly assuming the # of sub-PKs to be greater than 0.
let sub_pks : vec<vector<u8>> = deserialize_multi_ed25519_pk(ill_formed_validated_pk);

for i in 0..sub_pks.len() {
	if !verify_sub_sig(sub_sigs[i], sub_pks[i]) {
		return false;
	}
}

return true;
```

Note that, for any ill-formed PK with 0 sub PKs, any multisignature would pass this verification, which implies a loss of non-repudiation.

Although this example is far-fetched (since developers will likely rely on `0x1::multi_ed25519::signature_verify_strict`, which will reject the PK and thus any signature), it highlights the importance of maintaining the type safety of the struct so as to guarantee something meaningful to users about its de-serialized format.

## Rationale

**Q:** Explain why you submitted this proposal specifically over alternative solutions. Why is this the best possible outcome?

**A:** The hash functions just adds new functionality, so no alternatives were considered. The MultiEd25519 change is a bugfix. The alternative would have been not to fix it which, as argued above, is not ideal.

## Specification

The hash function and MultiEd25519 APIs are properly documented as part of the reference implementation below.

## Reference Implementation

 - [Blake2b-256 hash function](https://github.com/aptos-labs/aptos-core/pull/5436)
 - [SHA2-512, SHA3-512 and RIPEMD-160 hash functions](https://github.com/aptos-labs/aptos-core/pull/4181)
 - [MultiEd25519 PK validation V2](https://github.com/aptos-labs/aptos-core/pull/5822)

## Risks and Drawbacks

- The lack of a `#[deprecated]` or `#[deprecated_by=new_func_name]` annotation in Move makes it difficult to easily warn the users about using the outdated MultiEd25519 PK validation APIs. i.e.,:
  - the deprecated `0x1::multi_ed25519::public_key_validate` API
  - the deprecated `0x1::multi_ed25519::new_validated_public_key_from_bytes` API

- This means users could still call these APIs and accidentally find ways of mis-using the ill-formed PKs.

## Future Potential

The hash functions could be used for many cryptographic applications on chains (e.g., verifying zk-STARK proofs).

## Suggested implementation timeline

Everything has already been implemented.

## Suggested deployment timeline

This would likely make it to testnet early March.
