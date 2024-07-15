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
The reference implementation uses Poseidon hash function over BN254.

#### Verifiable unpredictable function (VUF)
Roughly speaking, a VUF is a mapping `f(x)` implicitly determined by a key pair `sk, pk` such that:,
- for a random input `x`, it is hard to predict `f(x)` without private key `sk`;
- for an output `y` claimed to be `f(x)`, anyone can verify if the claim is true using the public key `pk`.

These properties make the VUF output a good candidate for the pepper used in the keyless account flow.

Some concrete VUF schemes applicable here:
- BLS VUF (over BLS12-381 G1 group, refered to as `Bls12381G1Bls` below).
- [Pinkas VUF](https://eprint.iacr.org/2024/198.pdf).

Below we refer to the VUF scheme being used in pepper calculation as `vuf`,
and the evaluation function as `vuf.eval`.

#### Asymmetric encryption

In addition, an asymmetric encryption with variable-length input is required to encrypt the pepper with end user's ESK,
to ensure only the end user can see the pepper.
Otherwise, anyone who has access to a leaked JWT can learn the account address by interacting with the pepper service.

Here is an example asymmetric encryption scheme that combines ElGamal asymmetric encryption scheme and AES-256-GCM `(Aes256Gcm.enc, Aes256Gcm.dec)` symmetric encryption with variable-length input (assuming the ephemeral key pair is an Ed25519 key pair, scheme referred to as `ElGamalCurve25519Aes256Gcm` below).
- Let `x, Y` be the Ed25519 key pair.
- To ecrypt variable-lenth input `ptxt`:
  - Pick a point `M` from the Ed25519's underlying prime-order group uniformly at random.
  - Encrypt `M` using El-Gamal with public key `Y`. Denote by `C0, C1` the ciphertext, where `C0, C1` are 2 points on Curve25519.
  - Hash `M` to an AES-256-GCM key `aes_key`.
  - Encrypt `ptxt` using AES-256-GCM with encryption key `aes_key`. Denote by `ctxt` the variable-length AES ciphertext.
  - The full ciphertext is `C0, C1, ctxt`.
- To decrypt `C0, C1, ctxt`:
  - Recover `M` from `C0, C1` using El-Gamal decryption and private key `x`.
  - Hash `M` to an AES-256-GCM key `aes_key`.
  - Decrypt `ptxt` from `ctxt` using AES-256-GCM decryption with `aes_key`.
  - The final output is `ptxt`.

Below we refer to the asymmetric encryption scheme being used as `asymmetric`,
and its encryption algorithm as `asymmetric.enc`.

### Pepper service setup
The ephemeral key pair scheme, along with the parameters `derive_nonce`, `vuf`, `asymmetric` should be chosen before deploying pepper.

Additionally, depending on the choice `vuf`, a VUF key pair should also be generated and stored securely for the pepper service to read.

### Publish VUF public key
The pepper service should publish its VUF public key by opening an endpoint for anyone to fetch its public key.

Here is an example response where the VUF public key is serialized, hexlified and wrapped in a JSON,
assuming `vuf=Bls12381G1Bls`.
```JSON
{
  "public_key": "b601ec185c62da8f5c0402d4d4f987b63b06972c11f6f6f9d68464bda32fa502a5eac0adeda29917b6f8fa9bbe0f498209dcdb48d6a066c1f599c0502c5b4c24d4b057c758549e3e8a89ad861a82a789886d69876e6c6341f115c9ecc381eefd"
}
```

### Pepper request (the input)

The pepper repquest from user to pepper service should be as follows.
See the comments in the examples for detailed description.

```JSON
{
  /// User's ephemeral public key (EPK), serialized and hexlified.
  "epk": "002020fdbac9b10b7587bba7b5bc163bce69e796d71e4ed44c10fcb4488689f7a144",

  /// The EPK expiry date, represented in seconds seince unix epoch.
  "exp_date_secs": 1710800689,

  /// The EPK blinding factor, hexlified.
  "epk_blinder": "00000000000000000000000000000000000000000000000000000000000000",

  /// A JWT issued by the provider for the end user logging in to the dApp with the specified EPK.
  "jwt_b64": "xxxx.yyyy.zzzz",

  /// Optional. Determines which JWT claim to read user ID from. Defaults to `"sub"`.
  "uid_key": "email",
  
  /// Optional. If the `aud` claim in the JWT represents a special account recovery app, and `aud_override` is specified in the request,
  /// the pepper service should compute pepper for the `aud_override` instead of the original `aud` in JWT.
  ///
  /// This helps end users to transact with the account in case
  /// the OIDC provider blocked the app and stopped generating JWTs for it.
  "aud_override": "some-client-id-of-some-banned-google-app",
}
```

### Pepper request verification

The pepper request should be rejected if any check below fails.

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
- Let `aud` be the effective client ID determined by `jwt.payload.aud` and `aud_override`.
- Let `input` be a canonical serialization of data items `jwt.payload.iss, uid_key, uid_val, aud`.
- Compute `pepper` as `vuf.eval(vuf_sk, input)`.
- Let `pepper_bytes` be a serialization of the VUF output `pepper`.
- Compute `pepper_encryped` as `asymmetric.enc(epk, pepper_bytes)`.

### Pepper response (the output)

The pepper response from the pepper service to the user should simply be the pepper encrypted by the EPK, hexlified, and wrapped in a JSON.

Below is an example pepper response, assuming `vuf=Bls12381G1Bls` and `asymmetric=ElGamalCurve25519Aes256Gcm`.
```JSON
{
  "signature_encrypted": "6e0cf0dfdffbd22d0108195b54949b7840c3b7e4c9168f0899b60950f16e52cd54f0306cb8e76eda9fb3d5be6890cd3fc2c0cb259e3578dab6c7496b6d64553d4463a18aecf5bc3fc629cd88f9a78221b05b4d04d1a0a20292ed11f4197c5169227c86a6775b1c2990709cadf010cbf624763d68783eb466892d69a70c3c95a9fdffe5917e4554871db915b0"
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
