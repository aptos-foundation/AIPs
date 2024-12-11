---
aip: 81
title: Pepper service for keyless accounts
author: Zhoujun Ma (zhoujun@aptoslabs.com)
discussions-to (*optional): <a url pointing to the official discussion thread>
Status: Draft
last-call-end-date (*optional): <mm/dd/yyyy the last date to leave feedbacks and reviews>
type: <Standard (Core, Networking, Interface, Application, Framework) | Informational | Process>
created: 03/17/2024
updated (*optional): <mm/dd/yyyy>
requires (*optional): <AIP number(s)>
---

# AIP-81 - Pepper service for keyless accounts

## Summary

In [keyless accounts](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-61.md) an end user needs a private blinding factor (pepper) as an input in the privacy-preserving account address derivation:
as long as the pepper is not leaked, the link between the account and the provider/dApp owner behind it remains hidden.

This AIP proposes a solution to manange pepper for the end users without actually storing them by
deploying a public service (operated by Aptos Labs) that computes the pepper as a verifiable unpredictable function (VUF) of some session data (namely, the ephemeral public key from the end user and the authorization token (the JWT) from the OIDC provider).

### Goals

This is a fundamental building block [keyless accounts](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-61.md) infrastructure.

## Motivation

This is a fundamental building block [keyless accounts](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-61.md) infrastructure.

## Impact

DApp/SDK developers need to implement the interaction with pepper service in order to support the keyless flow.

## Alternative solutions

### Let dApp end users to manage their own pepper?
The whole point of using keyless accounts is to save users from memorizing extra secrets,
and this breaks the point.

### Let dApp service owners to manage the pepper?
It would make keyless account dApp-dependent:
if the dependency dApp dies, all the dependent accounts are not accessible.

## Specification

### Preliminaries

A few data items involved in the pepper service interaction is briefly explained below.
For the full glossaries, see [keyless account specification](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-61.md#specification).

A pair of *ephemeral private key (ESK) and ephemeral public key (EPK)*
is generated each time the user logs in to the OIDC provider in order to use a keyless flow-enabled app.
A keyless transaction requires an ephemeral signature generated using the ESK.

An *EPK expiry date* is a timestamp specified for every EPK. If an EPK's expiry date is past, the EPK is considered expired and cannot be used to sign transactions.

*EPK blinder* are some random bytes used to blind EPK and its expiry date
when committing them into the `nonce` field of the sign request sent to the OIDC provider.
(The issued `JWT` will contained the same `nonce`.)

### Public parameters

#### Nonce derivation
A function `derive_nonce()` is required to commit user's EPK, EPK blinder and the expiry timestamp into a nonce.
The nonce is then sent to the OIDC provider and signed as part of JWT payload.

The same function needs to be implemented as [part of the ZK relation](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-61.md#snark-friendly-hash-functions),
so SNARK-friendly hash function should be preferred.

#### Verifiable unpredictable function (VUF)
Roughly speaking, a VUF is a mapping `f(x)` implicitly determined by a key pair `sk, pk` such that:,
- for a random input `x`, it is hard to predict `f(x)` without private key `sk`;
- for an output `y` claimed to be `f(x)`, anyone can verify if the claim is true using the public key `pk`.

These properties make the VUF output a good candidate for the pepper used in the keyless account flow.

Some concrete VUF schemes applicable here:
- BLS VUF (over BLS12-381 G1 group, refered to as `Bls12381G1Bls` below).
- [Pinkas VUF](https://eprint.iacr.org/2024/198.pdf).

Below we refer to the VUF scheme being used in pepper calculation as `vuf`,
the evaluation function as `vuf.eval`,
and the vuf output entropy as `vuf_entropy`.

#### Pepper base hasher
A cryptographic hash function `H` with output bit-length `hash_bit_len` is needed to hash a VUF output into a bit string,
for further processing.

#### Constraints on `vuf` and `H`
At instantiation time, `vuf_entropy >= hash_bit_len ~= 256` must be ensured in order to get 256-bit pepper,
as required by [AIP-61](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-61.md#peppers).

### Instantiation in reference implementation
The reference implementation uses:
- Poseidon hash function over BN254 as the nonce derivation funciton;
- Pinkas VUF as the VUF;
- [`BCSCryptoHash` of struct `PinkasPepper`](https://github.com/aptos-labs/aptos-core/blob/807a2dbb186f088f347d568e0de63b1da6a6129e/keyless/pepper/common/src/vuf/bls12381_g1_bls.rs#L38-L39)
   as the pepper bash hasher.

### Publish VUF public key
The pepper service should publish its VUF public key by opening an endpoint for anyone to fetch its public key.

Here is an example response from the reference implementation.
```JSON
{
  "public_key": "b601ec185c62da8f5c0402d4d4f987b63b06972c11f6f6f9d68464bda32fa502a5eac0adeda29917b6f8fa9bbe0f498209dcdb48d6a066c1f599c0502c5b4c24d4b057c758549e3e8a89ad861a82a789886d69876e6c6341f115c9ecc381eefd" // pinkas vuf public key serialized and hexlified
}
```

### Pepper request (the input)

The pepper request from user should contain the following data items.
- User ephemeral public key (EPK)
- EPK expiry date
- EPK blinder
- JWT
- UID key (optional, default value: `"sub"` )
- [SLIP-0010](https://github.com/satoshilabs/slips/blob/master/slip-0010.md) derivation path
  (optional, default value: `"m/44'/637'/0'/0'/0'"`)

Here's an example request in JSON.

```JSON
{
  "epk": "002020fdbac9b10b7587bba7b5bc163bce69e796d71e4ed44c10fcb4488689f7a144", // EPK serialized and hexlified
  "exp_date_secs": 1710800689, // The EPK expiry date represented in seconds seince unix epoch
  "epk_blinder": "00000000000000000000000000000000000000000000000000000000000000", // The EPK blinder hexlified
  "jwt_b64": "xxxx.yyyy.zzzz",
  "uid_key": "email",
  "derivation_path": "m/44'/637'/0'/0'/0'"
}
```

### Pepper request verification

Following the notation from the JSON example above,
the pepper request should be rejected if any of the following checks fails.

- `epk` should be valid.
- Decoding `jwt_b64` into JSONs `jwt.header`, `jwt.payload`, `jwt.sig` should succeed,
  and `jwt.payload` should contain the following claims.
  - `jwt.payload.nonce`: a customizable field that keyless account scheme use to put commitment of user's ephemeral public key.
  - `jwt.payload.sub`: the user ID issued by the provider (or whatever field specified by `uid_key` in the request)
  - `jwt.payload.iss`: the provider
  - `jwt.payload.aud`: the client ID of the app issued by the provider
  - `jwt.payload.iat`: JWT generation time
- Ensure `epk` is committed in `jwt.nonce`, i.e., `jwt.nonce == derive_nonce(epk_blinder, exp_date_secs, epk)`.
- `jwt.payload.iss` and `jwt.header` should identiy a currently active JWT verification key (a.k.a JWK).
- Verification of `jwt.sig` with `jwt.payload` and the referenced JWK should pass.
- `exp_date_secs` should neither be in the past, nor too far in the future beyond `jwt.iat` plus a configured duration (default: 10,000,000 secs or ~115.74 days).

### Pepper processing
- Let `uid_val` be the user ID from `jwt.payload` indicated by `uid_key`.
- Obtain byte string `pepper_input` as [BCS serialization](https://github.com/aptos-labs/bcs)
  of data items `(jwt.payload.iss, uid_key, uid_val, jwt.payload.aud)`.
- Compute `pepper_base` as `vuf.eval(vuf_sk, input)`.
- Compute `master_pepper` as `H(pepper_base)`.
- Optionally:
  - derive byte string `derived_pepper` from `(master_pepper, derivation_path)`
    per key derivation scheme [SLIP-0010](https://github.com/satoshilabs/slips/blob/master/slip-0010.md);
  - derive byte string `id_commitment` from `(derived_pepper, jwt.payload.aud, uid_key, uid_val)`
    per [AIP-61](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-61.md#public-keys);
  - obtain an [`AnyPublicKey`](https://github.com/aptos-labs/aptos-core/blob/807a2dbb186f088f347d568e0de63b1da6a6129e/types/src/transaction/authenticator.rs#L1099) object `pk`
    by upcasting `(jwt.payload.iss, id_commitment)`;
  - obtain byte string `keyless_pk_bytes` as [BCS serialization](https://github.com/aptos-labs/bcs) of `pk`;
  - compute byte string `auth_key` as SHA3-256 of concatenation of `keyless_pk_bytes` and byte `0x02`, where `0x02` represents the account authenticator single key mode;
  - obtain `initial_account_address := auth_key`.
- Return `derived_pepper` and optionally `initial_account_address`.

Below is an example pepper JSON response used in the reference implementation.
```JSON
{
  "pepper": "854bd1eb56dfe35467493723360bb547a3f06c7ffc0c59733191fb05e8743f", // `derived_pepper` hexlified
  "address": "0x56f36f5c9fd3f07f9ae0704b7980dd2598afebdd1dc952c60775cd9a5c7c0731" // the initial account address
}
```

## Reference Implementation

https://github.com/aptos-labs/aptos-core/tree/main/keyless/pepper

## Testing (Optional)

Testing should be done as part of end-to-end testing of [keyless accounts](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-61.md).

## Risks and Drawbacks

The proposed pepper service is centralized, making it a single point of failure in the keyless transaction flow.
This can be mitigated by multiple deployments for now, which is easy to maintain due to its stateless nature.
In the future, a decentralized pepper service potentially run as part of Aptos validators can fully resolve the issue.

If the VUF private key is lost, all keyless accounts are inaccessible (unless the pepper is locally cached on user end).

If the VUF private key is leaked, the link between a keyless account and the OIDC provider/dApp owner is no longer private. For example, Google now may know which keyless account is derived from the JWT it signed.

## Future Potential

If the pepper service is instantiated with a weighted VUF (e.g., Pinkas VUF),
it has the potential to be decentralized:
- VUF private key needs to be shared between Aptos validators using a thresholded weighted key sharing scheme.
- A pepper request will be broadcasted to all validators and the pepper is obtained by verifying and aggregating enough pepper responses from validators.


## Timeline

### Suggested implementation timeline

 2024.01-03

### Suggested developer platform support timeline

SDK support are implemented in lock step with pepper service development.

### Suggested deployment timeline

Release 1.10

## Security Considerations

See [risks and drawbacks](#risks-and-drawbacks).
