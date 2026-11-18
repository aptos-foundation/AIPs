---
aip: 148 # (this is determined by the AIP Manager, leave it empty when drafting)
title: Domain separation practices
author: Alin Tomescu (alin@aptoslabs.com)
discussions-to (*optional): https://github.com/aptos-foundation/AIPs/discussions/677
Status: Draft # <Draft | Last Call | Accepted | Final | Rejected>
last-call-end-date (*optional): 06/01/2026 # <mm/dd/yyyy the last date to leave feedbacks and reviews>
type: Informational #<Standard (Core, Networking, Interface, Application, Framework) | Informational | Process>
created: 05/04/2026
updated (*optional): #<mm/dd/yyyy>
requires (*optional): #<AIP number(s)>
---

# AIP-X - Domain-separation practices

## Summary

This AIP documents **domain-separation practices** in our codebase.

The **goal** for this AIP is to serve as a *key reference document* when asking ourselves this question:

>  *"Is this a new scheme we are adding domain-separated from all previous schemes?"*

### Out of scope

This AIP is **not** *prescriptive*: it does not aim to propose a universal domain separation scheme that can be used throughout our various codebases (Rust, Move, TypeScript, etc.) and use-cases.

### Terminology and notation

We use `"<str>"` to denote a string `<str>`.

We use `a || b` to denote concatenating two byte sequences together.

We often talk about the **signing message**, the actual sequence of bytes given as input to the signing algorithm (e.g., to the Ed25519 signing algorithm which takes an arbitrary sequence of bytes as input).

_Note:_ Whether the signing algorithm hashes this input internally is of no concern (e.g., Ed25519 signing does hash the message internally via Fiat-Shamir, but we don't care).

## Scheme: Rust struct signing

We often need to sign a **Rust** struct `obj` of type `T`. The **signing message** is:

```
signing_message(obj) = 
  sha3_256( "APTOS::" || serde_name(T) )
  || 
  bcs::encode(obj)
```

 > [!NOTE]
 >
 > 1. The `serde_name(T)` used as the domain-separation tag is the struct's serde name, which is the Rust identifier as-is (e.g., struct `Foo` ⇒ salt bytes `b"Foo"`) unless overridden by `#[serde(rename = "...")]`. Because identifiers are taken verbatim, structurally similar names such as `AbcStruct` and `ABCStruct` produce distinct salts and thus distinct hashes.
 > 2. We discuss the Rust implementation details in [the appendix](#appendix-the-cryptohasher-and-bcscryptohash-macros-in-aptos-core)

> [!WARNING]
>
> There is a [script](https://github.com/aptos-labs/aptos-core/blob/main/scripts/check-cryptohasher-symbols.py) in `aptos-core`'s CI/CD that checks for accidental collisions due to indentical `serde` struct names (e.g., when declaring a struct with the same name across different Rust modules).
>
> Unfortuntely, it only catches identical names, not equivalent `#[serde(rename)]` collisions.
>
> Note that this was **not** designed to catch backwards-incompatible renames: e.g., unwittingly-renaming `Foo` to `Bar` and breaking everyone due to the different domain separator being derived.

> [!CAUTION]
>
> `serde_name(T)` erases generics: e.g., both `TransactionAndProof<A>` and `TransactionAndProof<B>` have the same `serde_name`. This is dangerous.

### Signature schemes employed

To sign `obj`, all signature schemes in `aptos-core` call [`signing_message`](https://github.com/aptos-labs/aptos-core/blob/main/crates/aptos-crypto/src/traits/mod.rs#L170-L177) on `obj`, take the resulting bytes and call their actual signing algorithm on it:

- [Ed25519](https://github.com/aptos-labs/aptos-core/blob/main/crates/aptos-crypto/src/ed25519/ed25519_sigs.rs#L113) (e.g., when a user authorizes their TXN)
- [MultiEd25519](https://github.com/aptos-labs/aptos-core/blob/main/crates/aptos-crypto/src/multi_ed25519.rs#L495)
- [BLS-over-BLS12-381](https://github.com/aptos-labs/aptos-core/blob/main/crates/aptos-crypto/src/bls12381/bls12381_sigs.rs#L141) (e.g., when validators vote on blocks)
- [ECDSA-over-secp256r1](https://github.com/aptos-labs/aptos-core/blob/main/crates/aptos-crypto/src/secp256r1_ecdsa/secp256r1_ecdsa_sigs.rs#L123) (although WebAuthn passkeys in `aptos-core` don't leverage Rust struct signing)
- [SLH-DSA-SHA2-128s](https://github.com/aptos-labs/aptos-core/blob/main/crates/aptos-crypto/src/slh_dsa_sha2_128s/slh_dsa_sigs.rs#L66)
- [ECDSA/SHA3-256-over-secp256k1](https://github.com/aptos-labs/aptos-core/blob/main/crates/aptos-crypto/src/secp256k1_ecdsa.rs#L267)
  - We view our ECDSA signing algorithm as one that takes any arbitrary-length signing message and hashes it internally using SHA3-256, as an implementation detail.
  - Alternatively, we could view it as a "raw" ECDSA-over-secp256k1 implementation whose signing message is a field element $m\in \mathbb{Z}_p$, which our code base always ensures is computed as `sha3_256(signing_message(obj))`$\bmod p$. But this is inconsistent with the `signing_message(obj)` convention we are trying to establish.

## Scheme: Rust struct hashing

We often hash Rust structs in our codebase:

- when Merkle hashing (transactions, state, events, write sets)
- when deriving dentifiers (deterministic 32-byte IDs for structs are used in a lot of our consensus code: e.g., `BlockData`, `BatchInfo`, `Waypoint`, `ValidatorTransaction`)
- during the Fiat-Shamir transform in our PVSS implementations.

The hash of a **Rust** struct `obj` of type `T`  is just the SHA3-256 of the [signing message defined above](#Scheme-Rust-struct-signing):

```
hash(obj) = sha3_256( signing_message(obj) )
          = sha3_256(
              sha3_256( "APTOS::" || serde_name(T) )
              ||
              bcs::encode(obj)
          )
```

 > [!NOTE]
 > The original Libra codebase chose to domain separate the "hash of an object" (i.e., `hash(obj)` defined just above) from the "signing message of an object" (i.e., [`signing_message(obj)`](#Scheme-Rust-struct-signing) defined before).
 >
 > This seems cautious, but it unfortunately adds (unnecessary?) complexity to the code.

## Scheme: Move struct (Multi)Ed25519 signing

We often sign **Move** (not Rust) structs `obj` of type `T` (declared in some Move module `module_name` at address `account_address`) using (Multi)Ed25519 and verify such signatures via [`aptos_std::ed25519::signature_verify_strict_t<T>`](https://github.com/aptos-labs/aptos-core/blob/main/aptos-move/framework/aptos-stdlib/sources/cryptography/ed25519.move#L142-L149) or [`aptos_std::multi_ed25519::signature_verify_strict_t<T>`](https://github.com/aptos-labs/aptos-core/blob/main/aptos-move/framework/aptos-stdlib/sources/cryptography/multi_ed25519.move#L229-L233), which reuses the same envelope). The **signing message** is derived as follows:

```
signing_message(obj) = bcs::encode(SignedMessage<T> {
  type_info: type_of<T>,
  inner: obj,
})
```

The [`aptos_std::type_info::TypeInfo`](https://github.com/aptos-labs/aptos-core/blob/main/aptos-move/framework/aptos-stdlib/sources/type_info.move#L19-L23) struct is defined as:

```rust
struct TypeInfo has copy, drop, store {
  account_address: address,
  module_name: vector<u8>, 
  struct_name: vector<u8>,
}
```

So, from `bcs::encode`'s perspective, which does not care about nesting nor struct names, the **signing message** can more simply be described as:

```
signing_message(obj) = bcs::encode({
  // type info
  account_address, // [u8; 32]
  module_name,     // Vector<u8>
  struct_name,     // Vector<u8>
  // actual object
  obj,
})
```

> [!CAUTION]
> Unfortunately, this is **not** properly domain-separated from Rust struct hashing and should be re-done. Since updating it in place would break existing applications, a new function & standard should be added.
>
> The good news is wallets do not expose signing Move structs. (Or, at least, Petra does not.)

### Examples of signing Move structs

Within `aptos-framework`:

- [`aptos-framework/sources/account/account.move`](https://github.com/aptos-labs/aptos-core/blob/main/aptos-move/framework/aptos-framework/sources/account/account.move) verifies signatures over Move structs via `ed25519::signature_verify_strict_t` or `multi_ed25519::signature_verify_strict_t`, in the context of authentication-key rotation and capability delegation.
- [`aptos-framework/sources/multisig_account.move`](https://github.com/aptos-labs/aptos-core/blob/main/aptos-move/framework/aptos-framework/sources/multisig_account.move) verifies signatures over proof-challenge structs (via [`account::verify_signed_message`](https://github.com/aptos-labs/aptos-core/blob/main/aptos-move/framework/aptos-framework/sources/account/account.move#L1241-L1279), which delegates to `(multi_)ed25519::signature_verify_strict_t`) when bootstrapping a multisig account on top of an existing account.

We describe the relevant structs below.

1. **[`RotationProofChallenge`](https://github.com/aptos-labs/aptos-core/blob/main/aptos-move/framework/aptos-framework/sources/account/account.move#L112-L121)**, signed by the holder of the *new* key when rotating an account's authentication key, proving they control the new SK.
   
   ```rust
   // WARNING: Missing a chain_id field (discussed later)
   struct RotationProofChallenge has copy, drop {
       sequence_number: u64,
       originator: address,
       current_auth_key: address,
       new_public_key: vector<u8>,
   }
   ```
   
2. **[`RotationCapabilityOfferProofChallengeV2`](https://github.com/aptos-labs/aptos-core/blob/main/aptos-move/framework/aptos-framework/sources/account/account.move#L138-L143)**, signed when an account delegates its key-rotation capability to a `recipient_address`.
   
   ```rust
   struct RotationCapabilityOfferProofChallengeV2 has drop {
       chain_id: u8,
       sequence_number: u64,
       source_address: address,
       recipient_address: address,
   }
   ```
   
3. **[`SignerCapabilityOfferProofChallengeV2`](https://github.com/aptos-labs/aptos-core/blob/main/aptos-move/framework/aptos-framework/sources/account/account.move#L145-L149)**, signed when an account delegates its signer capability via [`offer_signer_capability`](https://github.com/aptos-labs/aptos-core/blob/65541687de18b6207c74a4bb83153aeaddf7890a/aptos-move/framework/aptos-framework/sources/account/account.move#L979).
   
   ```rust
   // WARNING: Missing a chain_id field (discussed later)
   struct SignerCapabilityOfferProofChallengeV2 has copy, drop {
       sequence_number: u64,
       source_address: address,
       recipient_address: address,
   }
   ```

4. **[`MultisigAccountCreationMessage`](https://github.com/aptos-labs/aptos-core/blob/main/aptos-move/framework/aptos-framework/sources/multisig_account.move#L175-L187)**, signed by the owner of an existing account that is about to be converted into a multisig account.
   
   ```rust
   struct MultisigAccountCreationMessage has copy, drop {
       chain_id: u8,
       account_address: address,
       sequence_number: u64,
       owners: vector<address>,
       num_signatures_required: u64,
   }
   ```

5. **[`MultisigAccountCreationWithAuthKeyRevocationMessage`](https://github.com/aptos-labs/aptos-core/blob/main/aptos-move/framework/aptos-framework/sources/multisig_account.move#L190-L202)**, same as above but additionally authorizes rotating the original auth key to `0x0` so that the original account is fully governed by the multisig.
   
   ```rust
   struct MultisigAccountCreationWithAuthKeyRevocationMessage has copy, drop {
       chain_id: u8,
       account_address: address,
       sequence_number: u64,
       owners: vector<address>,
       num_signatures_required: u64,
   }
   ```

> [!WARNING]
>
> The `RotationProofChallenge` and `SignerCapabilityOfferProofChallengeV2` structs are missing a `chain_id` field that would domain separate signatures over these structs across different networks. This raises the question: could an attacker replay signatures over these structs from, say, `testnet` on `mainnet`?
>
> Fortunately, such replays are not enough for an attack: the attacker needs to send a `mainnet` transaction that calls an entry function verifying such a Move struct signature. Recall that these structs can only be constructed inside `account.move`, so the entry functions there are their only "consumers." All but one of them (`rotate_authentication_key`, `upsert_ed25519_backup_key_on_keyless_account`, and `offer_signer_capability`) take as `&signer` the account named in the Move struct (its `originator` or `source_address`), so the transaction must be sent by the victim’s account.
>
> Thankfully, due to proper domain separation in `RawTransaction[WithData]` across chains via `chain_id`,  such `mainnet` transactions would need a new signature; they cannot reuse the `tesnet` transaction signature. So the attacker would need the victim’s signature on a `mainnet` `RawTransaction`, i.e., a forgery.
>
> In addition to all of these, the sequence numbers of the `testnet` and `mainnet` account would need to match for such a forgery to be successfully applied. (This is in no way a good defense assumption though.)
>
> Nonetheless, these Move structs should be upgraded to a `V2` and `V3`, respectively, to include a `chain_id` field.

As an aside, outside the framework, the [`mint_nft` tutorial](https://github.com/aptos-labs/aptos-core/blob/main/aptos-move/move-examples/mint_nft/4-Getting-Production-Ready/sources/create_nft_getting_production_ready.move#L302) also **badly** teaches how to sign a **[`MintProofChallenge`](https://github.com/aptos-labs/aptos-core/blob/main/aptos-move/move-examples/mint_nft/4-Getting-Production-Ready/sources/create_nft_getting_production_ready.move#L127-L131)** Move struct without a `chain_id` field:

```rust
struct MintProofChallenge has drop {
    receiver_account_sequence_number: u64,
    receiver_account_address: address,
    token_data_id: TokenDataId,
}
```
This example should be updated to add a `chain_id` field in the struct above.

## Scheme: `signMessage` flow for dapps to request signatures over arbitrary messages

Wallets like Petra allow any dapp to request a signature from the user over a dapp-specified `(<message>, <nonce>)`[^petra-signing-a-message] request. The dapp can indicate it wants the wallet to also sign over:

- the user's address: i.e., `<address>`
- the dapp's domain: i.e., `<application>`
- the chain ID: i.e., `<chainId>`

The dapp sends the request tuple to the wallet. If the user approves the request, the wallet derives the **signing message** (in this order) as:

```
signing_message(address, application, chainId, message, nonce) =
  "APTOS\n" ||
  [ "address: " || address || "\n" ||         ]
  [ "application: " || application || "\n" || ]
  [ "chainId: " || chainId || "\n" ||         ]
  "message: " || message || "\n" ||
  "nonce: "|| nonce || "\n"
```

> [!NOTE]
>
> `[ optional_part ]` denotes optionally-included components.
>
> For clarity, newlines are included explictly by concatenating `"\n"` characters.
>
> The **minimum** signing-message length is **24 bytes** — `"APTOS\nmessage: \nnonce: \n"` with all optional fields omitted and empty `message` and `nonce`. So a Petra signed message can be shorter than 32 bytes; domain separation against other 32-byte schemes (e.g., the [confidential-assets DK signing message](#scheme-confidential-assets-decryption-key-dk-derivation)) relies on the literal `APTOS\n` prefix (byte `0x41`), not on length.

To illustrate more clearly, here's an example signing message:

```
APTOS
address: 0x0x69f6d036d782847c30aa02a5cc416dbe309d08fa86dc3fb9e1899fde94ebff23
application: mydapp.org
message: Welcome to dapp!
nonce: 1234034
```

> [!NOTE]
>
> Confirmed against Petra implementation that the signing message is what actually gets forwarded to the signing algorithms.

> [!WARNING]
>
> The `signMessage` flow is **correctly domain-separated** from every current Rust struct signing scheme and every current framework Move struct signing scheme, by virtue of all three categories disagreeing on their leading bytes:
>
> | Scheme (and its prefix that acts as a domain-separator) | Signing-message prefix (first 6 bytes) |
> |---|---|
> | **Petra `signMessage`** (literal ASCII `APTOS\n`) | `0x4150544f530a` |
> | Rust `RawTransaction` (`sha3_256("APTOS::RawTransaction")`) | `0xb5e97db07fa0...` |
> | Rust `RawTransactionWithData` (`sha3_256("APTOS::RawTransactionWithData")`) | `0x5efa3c4f02f8...` |
> | Rust `AASigningData` (`sha3_256("APTOS::AASigningData")`) | `0xb020f512f57d...` |
> | Rust `TransactionAndProof` (`sha3_256("APTOS::TransactionAndProof")`) | `0xa5f5d4e13051...` |
> | Move `0x1::account::RotationProofChallenge` (`bcs(SignedMessage<T>)`) | `0x000000000000...` (first 32 bytes are address `0x1` = `0x000...0001`) |
> | Move `0x1::account::RotationCapabilityOfferProofChallengeV2` | `0x000000000000...` |
> | Move `0x1::account::SignerCapabilityOfferProofChallengeV2` | `0x000000000000...` |
> | Move `0x1::multisig_account::MultisigAccountCreationMessage` | `0x000000000000...` |
> | Move `0x1::multisig_account::MultisigAccountCreationWithAuthKeyRevocationMessage` | `0x000000000000...` |
>
> - `signMessage` payloads start with byte `0x41` (`'A'` of `APTOS\n`).
> - Each current Rust signing seed is a SHA3-256 output whose first byte happens not to equal `0x41`.
> - Every framework Move struct signing message starts with byte `0x00` (the leading byte of `bcs(0x1)`).
>
> This safety is by luck, not by good design: the Rust seeds happen not to start with `APTOS\n` and will not hold. The `signMessage` flow should be domain-separated properly.

## Scheme: Sign in with Aptos (SIWA) flow for dapps to authenticate Aptos users

[AIP-116](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-116-sign-in-with-aptos.md) standardizes a one-click `signIn` request that replaces the older `connect` + `signMessage` flow for dapp authentication. The dapp sends an `AptosSignInInput` to the wallet, the wallet fills in *bound fields* it controls (`address`, `chainId`, `domain`, `uri`, `version`), and constructs a plain-text **SIWA message** of the form:

```
siwa_msg =
  domain || " wants you to sign in with your Aptos account:\n" ||
  address ||
  [ "\n\n" || statement ] ||
  [ "\nURI: "             || uri ] ||
  [ "\nVersion: "         || version ] ||
  [ "\nChain ID: "        || chainId ] ||
  [ "\nNonce: "           || nonce ] ||
  [ "\nIssued At: "       || issuedAt ] ||
  [ "\nExpiration Time: " || expirationTime ] ||
  [ "\nNot Before: "      || notBefore ] ||
  [ "\nRequest ID: "      || requestId ] ||
  [ "\nResources:" || ("\n- " || resources[0]) || ("\n- " || resources[1]) || ... ]
```

Only `domain` and `address` are mandatory; the rest are included only when present in the `AptosSignInInput`.

The **signing message** is then derived by [AIP-116's Domain Separated Signing Algorithm](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-116-sign-in-with-aptos.md#domain-separated-signing-algorithm):

```
signing_message(siwa_msg) = sha3_256(b"SIGN_IN_WITH_APTOS::") || siwa_msg
```

> [!NOTE]
> This is **correctly** domain-separated from Rust struct signing (which prefixes with `sha3_256("APTOS::" || serde_name(T))`).
>
> Also, it is correctly domain-separated from the Petra `signMessage` flow (which prefixes with the literal ASCII `APTOS\n`), because the two prefixes are byte-wise disjoint:
>
> - **SIWA seed** (first 6 bytes of the 32-byte hash output): `0x1ec2d48cc8cf...`
> - **Petra `signMessage` prefix** (6 ASCII bytes for `APTOS\n`): `0x4150544f530a`
>
> No SIWA payload can ever match the start of a Petra `signMessage` payload (or vice versa), so the two schemes cannot be confused by any signer.
>
> The implementation lives in the [`@aptos-labs/siwa`](https://www.npmjs.com/package/@aptos-labs/siwa) npm package (not in `aptos-ts-sdk`) built from the [aptos-labs/sign-in-with-aptos](https://github.com/aptos-labs/sign-in-with-aptos) repo. 
>
> The wallet calls `createSignInMessage(...)` to build the plain-text message and `createSignInSigningMessage(plainText)` to apply the domain-separator prefix, then feeds the result into the same `Signer.signBuffer(buffer: Uint8Array)` path used by `signMessage`.

## Scheme: Confidential assets decryption key (DK) derivation

In Petra, we derive a confidential asset (CA) decryption key (DK) by having the wallet sign the following **signing message** (currently, only via Ed25519 signatures):

```
signing_message = sha3_256("APTOS_CONFIDENTIAL_ASSETS::DK_DERIVATION::" || chain_name)
```

where:

- `chain_name` is the literal ASCII string `"mainnet"`, `"testnet"`, or `"devnet"` (chain *name*, **not** the numeric chain ID, so that the value is stable across devnet resets).

The concrete 32-byte values are:

| Chain | Tag string | Signing message (32 bytes) |
|---|---|---|
| **mainnet** | `b"APTOS_CONFIDENTIAL_ASSETS::DK_DERIVATION::mainnet"` | `0xb22523cee15e8a94819a13ae96b7d5d8d8ef42213aa2b56f4fe5c40ea848e46c` |
| **testnet** | `b"APTOS_CONFIDENTIAL_ASSETS::DK_DERIVATION::testnet"` | `0xcc51262a1ec8b1fc392dd02e9cd92e13f53fec4fd481ee5d5b3c3d8f58e247e6` |
| **devnet** | `b"APTOS_CONFIDENTIAL_ASSETS::DK_DERIVATION::devnet"` | `0xfa56c4a0724a76979f09c7dbff5c31865ba5ef1d08eef0446581a450124c88e9` |

> [!WARNING]
>
> Obiviously, once fixed **we cannot not rename `"mainnet"` / `"testnet"` / `"devnet"`** without a coordinated migration. Otherwise, all previously-derived DKs become unreachable. The same applies if a new network is added: the spec must explicitly choose the string before any wallet derives a DK on it.

> [!NOTE]
>
> This is **correctly** domain-separated from every other signing scheme described in this AIP. Each chain's CA-DK signing message is *exactly* 32 bytes: the raw SHA3-256 output, with nothing concatenated after it.
>
> Every other signing scheme in this document produces a signing message that is **strictly longer than 32 bytes** or starts with a structurally-distinct fixed prefix:
> 
> - **[Rust struct signing](#scheme-rust-struct-signing)**: the 32-byte seed is followed by `bcs::encode(obj)` $\Rightarrow$ larger length for any non-trivial struct.
> - **[Move struct signing](#scheme-move-struct-multied25519-signing)**: begins with `bcs(address)` (32 bytes) plus at least the ULEB128 length byte for `module_name` $\Rightarrow$ length $> 32$.
>- **[SIWA signing](#scheme-sign-in-with-aptos-siwa-flow-for-dapps-to-authenticate-aptos-users)**: 32-byte seed followed by non-empty SIWA plaintext $\Rightarrow$ length $> 32$.
> - **[Petra `signMessage`](#scheme-signmessage-flow-for-dapps-to-request-signatures-over-arbitrary-messages)**: starts with `0x41` (`'A'` of `APTOS\n`); each CA-DK chain-message starts with `0xb2` (mainnet) / `0xcc` (testnet) / `0xfa` (devnet) $\Rightarrow$ disjoint on the first byte.

### Why not also bind the account address?

A natural variant would be to append the 32-byte account address to the signing message: `sha3_256(b"...DK_DERIVATION::<chain_name>") || address`. We chose *not to* do this for two reasons:

1. **It complicates the domain-separation argument against Move struct signing.** With the address appended, the CA-DK signing message becomes 64 bytes. The _"first 32 bytes are different"_ argument still works for framework Move structs (whose first byte is `0x00`), but for dapp-deployed Move modules the argument shifts to _"an attacker can't grind a 32-byte module address that equals `sha3_256(b"...DK_DERIVATION::<chain_name>")`"_, which is less robust to future mechanism of deriving addresses.

2. **Address-specific DKs do not have a big security benefit.** The main win is that if we derived different DKs from the same SK for different addresses, then leakage of one of these DKs does not imply leakage of the others. But still, leakage of the SK continues to imply leakage of all DKs. I do not immediately see a use case where it would be helpful to allow DKs derived from the same SK to leak. If such use-cases exist, we can add a new derivation scheme for them in the future.

## Scheme: Address derivation

All address-derivation schemes in `aptos-core` follow the same shape:

```
addr = sha3_256(account_identifier_or_pubkey || SCHEME_ID)
```

where `account_identifier_or_pubkey` is some scheme-specific byte string (a `pubkey`, a `source_addr || seed`, a `txn_hash || counter`, etc.) and `SCHEME_ID` is a 1-byte tag from [`pub enum Scheme`](https://github.com/aptos-labs/aptos-core/blob/main/types/src/transaction/authenticator.rs#L522-L540) appended to the preimage. Each `SCHEME_ID` is distinct, so every scheme below is correctly domain-separated from every other one.

### Normal account address derivation

For accounts backed by a regular signature scheme, addresses are derived from a public key `pubkey` (`Vec<u8>`) and the signature scheme's ID:

```
addr = sha3_256(pubkey || SCHEME_ID)
```

where:

- `SCHEME_ID` is a supported scheme IDs: i.e., `0x00`–`0x03` (Ed25519, MultiEd25519, SingleKey, MultiKey).

### Resource account address derivation

[`account::create_resource_address()`](https://github.com/aptos-labs/aptos-core/blob/main/aptos-move/framework/aptos-framework/sources/account/account.move#L1099) derives addresses from a `source` (`signer`) and a `seed` (`Vec<u8>`):

```
rsrc_addr = sha3_256(source.address() || seed || RSRC_ACCOUNT_ADDR_DERIV_SCHEME_ID)
```

where:

- `RSRC_ACCOUNT_ADDR_DERIV_SCHEME_ID` (`u8`) is a constant, set to `0xFF` (255).

### Object address derivation (from seed)

[`object::create_object_address()`](https://github.com/aptos-labs/aptos-core/blob/main/aptos-move/framework/aptos-framework/sources/object.move#L215-L220) derives a "named object" address from a creator's `source_addr` and a user-supplied `seed` (`Vec<u8>`):

```
obj_addr = sha3_256(source_addr || seed || OBJECT_FROM_SEED_ADDRESS_SCHEME)
```

where:

- `OBJECT_FROM_SEED_ADDRESS_SCHEME` (`u8`) is a constant, set to `0xFE` (254).

### Object address derivation (from GUID)

[`object::create_guid_object_address()`](https://github.com/aptos-labs/aptos-core/blob/main/aptos-move/framework/aptos-framework/sources/object.move#L232-L237) derives an object address from a GUID generated by the creator at `source_addr`:

```
obj_addr = sha3_256(bcs::encode(guid) || OBJECT_FROM_GUID_ADDRESS_SCHEME)
```

where:

- `guid = account::create_guid(create_signer(source_addr))` (account-bound monotonic counter)
- `OBJECT_FROM_GUID_ADDRESS_SCHEME` (`u8`) is a constant, set to `0xFD` (253).

### Object address derivation (user-derived from another object)

[`object::create_user_derived_object_address()`](https://github.com/aptos-labs/aptos-core/blob/main/aptos-move/framework/aptos-framework/sources/object.move#L227-L229) (used only by `primary_fungible_store`), implemented natively by [`AuthenticationKey::object_address_from_object()`](https://github.com/aptos-labs/aptos-core/blob/main/types/src/transaction/authenticator.rs#L982-L989), derives an object's address from a `source_addr` and another existing object's address `derive_from_addr`:

```
obj_addr = sha3_256(source_addr || derive_from_addr || OBJECT_DERIVED_SCHEME)
```

where:

- `OBJECT_DERIVED_SCHEME` (`u8`) is a constant, set to `0xFC` (252).

### Auto-Unique Identifier (AUID) address derivation

[`transaction_context::generate_auid_address()`](https://github.com/aptos-labs/aptos-core/blob/main/aptos-move/framework/aptos-framework/sources/transaction_context.move#L64-L66), backed by [`AuthenticationKey::auid()`](https://github.com/aptos-labs/aptos-core/blob/main/types/src/transaction/authenticator.rs#L977-L980), derives a globally unique address tied to the current TXN:

```
auid_addr = sha3_256(txn_hash || auid_counter_le_u64 || DERIVE_AUID_ADDRESS_SCHEME)
```

where:

- `txn_hash` is the SHA3-256 hash of the current TXN
  - Note: the uniqueness of `txn_hash` is assumed here. While this is currently true, this assumption must be maintained in the ever-changing codebase over time.
- `auid_counter_le_u64` is a per-TXN monotonically-incrementing counter (little-endian `u64`)
- `DERIVE_AUID_ADDRESS_SCHEME` (`u8`) is a constant, set to `0xFB` (251)

This is the primitive that backs `object::create_object()` (a deletable object at a fresh, never-before-seen address).

### Derivable account abstraction (DAA) address derivation

Accounts using a derivable account authenticator[^daa-docs] have their addresses derived via [`AuthenticationKey::domain_abstraction_address()`](https://github.com/aptos-labs/aptos-core/blob/main/types/src/transaction/authenticator.rs#L991-L998):

```
addr = sha3_256(
  bcs::encode(func_info)                  ||
  bcs::encode(account_identity_bytes)     ||
  DERIVE_DOMAIN_ABSTRACTION_SCHEME
)
```

where:

- `func_info` is the on-chain authenticator function identifier
- `account_identity_bytes` is a domain-specific identity blob (e.g., an RSA pubkey)

- `DERIVE_DOMAIN_ABSTRACTION_SCHEME` (`u8`) is a constant, set to `0x05` (5)

## Appendix: The`CryptoHasher` and `BCSCryptoHash` macros in `aptos-core`

### 1. `CryptoHash` trait

The *"how do I hash this type"* trait. Defined at [`crates/aptos-crypto/src/hash.rs:557-563`](https://github.com/aptos-labs/aptos-core/blob/main/crates/aptos-crypto/src/hash.rs#L557-L563):

```rust
pub trait CryptoHash {
    type Hasher: CryptoHasher;   // associated type: the hashing state machine for this struct
    fn hash(&self) -> HashValue; // produces the digest
}
```

Two responsibilities:

- Pick a `Hasher` type (which carries the type's domain-separation seed).
- Define `hash(&self)` — i.e., how to fold `self` into bytes and finalize.

### 2. `CryptoHasher` trait

The **hashing state machine trait**, much like a normal SHA3-256 hashing state machine trait (e.g., [`tiny_keccak::Hasher`](https://docs.rs/tiny-keccak/latest/tiny_keccak/trait.Hasher.html)), except pre-seeded with the type-specific salt, hence its `seed()` method. Defined at [`crates/aptos-crypto/src/hash.rs:588-611`](https://github.com/aptos-labs/aptos-core/blob/main/crates/aptos-crypto/src/hash.rs#L588-L611):

```rust
pub trait CryptoHasher: Default + std::io::Write {
    fn seed() -> &'static [u8; 32];   // 32-byte domain tag for this type
    fn update(&mut self, bytes: &[u8]);
    fn finish(self) -> HashValue;
    // + default impls for hash_all, hash_two_children
}
```

Every type that wants to be `CryptoHash`-able needs its own `CryptoHasher`-implementing struct (e.g., `BlockData` → `BlockDataHasher`) whose `seed()` returns *its* `sha3_256("APTOS::" || serde_name(T))`.

### 3. `CryptoHasher` derive macro

Generates a **hashing state machine struct** `THasher` for `T` implementing `CryptoHasher`, such that:

- its `seed()` returns `sha3_256("APTOS::" || serde_name(T))`
- `update()` / `finish()` are wired to an inner `tiny_keccak::Sha3::v256()` state (see [`DefaultHasher::new`](https://github.com/aptos-labs/aptos-core/blob/main/crates/aptos-crypto/src/hash.rs#L635-L641)).

**Important:** This does **not** implement `CryptoHash` for `T`. It only provides the hashing state machine you can plug into one.

### 4. `BCSCryptoHash` derive macro

Generates the **default `CryptoHash` impl** for `T`, producing:

```rust
impl CryptoHash for T {
    type Hasher = THasher;       // <-- assumes the CryptoHasher macro has been invoked
    fn hash(&self) -> HashValue {
        let mut state = THasher::default();
        bcs::serialize_into(&mut state, &self).expect(...);
        state.finish()
    }
}
```

i.e., the canonical recipe: `sha3_256(seed_T || bcs(self))`. Requires `THasher` to exist, so it's always paired with `#[derive(CryptoHasher)]`.

See a unit test [here](https://github.com/aptos-labs/aptos-core/blob/c0e7e28025660ec88734e62a011cee61bcf4b282/crates/aptos-crypto/src/unit_tests/cryptohasher.rs#L86).

### 5. When do we write `CryptoHash` by hand?

Whenever you want a `T::Hasher` via `#[derive(CryptoHasher)]` but you want a `CryptoHash` for `T`  that does not (necessarily) hash by BCS-encoding `T`. If so, you skip `BCSCryptoHash` and write the `CryptoHash` implementation manually, choosing what bytes to absorb inside its `hash` method.

Real example in [`consensus/consensus-types/src/block_data.rs:72,105-134`](https://github.com/aptos-labs/aptos-core/blob/main/consensus/consensus-types/src/block_data.rs#L105-L134):

```rust
#[derive(CryptoHasher, ...)]   // gets BlockDataHasher
pub struct BlockData { ... }

impl CryptoHash for BlockData {
    type Hasher = BlockDataHasher;
    fn hash(&self) -> HashValue {
        let mut state = BlockDataHasher::default();
        if self.is_opt_block() {
            // hash a *projection* of self (replaces quorum_cert with just its vote_data)
            bcs::serialize_into(&mut state, &OptBlockDataForHash { ... }).expect(...);
        } else {
            bcs::serialize_into(&mut state, &self).expect(...);
        }
        state.finish()
    }
}
```

So the split between the two derive macros is:

- `CryptoHasher` gives you the *domain-separated state machine* (always wanted)
- `BCSCryptoHash` gives you the *default encoding strategy* (often wanted, sometimes overridden)

### TL;DR

| Item | Kind | What it is, or what it gives you? |
|---|---|---|
| `CryptoHasher` | **trait** | It's a hashing state machine trait, pre-seeded with a per-type domain tag, with `seed()`, `update()`, `finish()` methods |
| `CryptoHash` | **trait** | It's a "*how do I hash this type?"* trait, with a `type Hasher: CryptoHasher` associated type and a `fn hash(&self) -> HashValue` |
| `#[derive(CryptoHasher)]` | **macro** | Gives a `THasher` struct implementing the `CryptoHasher` trait, with `seed() = sha3_256( "APTOS::" || serde_name(T) )` |
| `#[derive(BCSCryptoHash)]` | **macro** | Gives a `impl CryptoHash for T` whose `hash()` is `sha3_256(seed || bcs(self))`. Requires `CryptoHasher` for `T` to also be derived and set as the associated type. |
| Hand-rolled `impl CryptoHash for T` | manual | Used when you want a non-default encoding (projection, custom field order, conditional encoding, etc.). Pair with `#[derive(CryptoHasher)]`. |

## Appendix: ECDSA over secp256k1 signing

The "raw" ECDSA signature scheme can only sign a scalar in $\mathbb{Z}_p$ where $p$ is the order of the curve, so the `libsecp256k1` crate requires the caller to pre-hash an arbitrary-length message to 32-bytes (really, it should be to $\mathbb{Z}_p$, but I guess they're not worried about collisions). From [`crates/aptos-crypto/src/secp256k1_ecdsa.rs:88-96`](https://github.com/aptos-labs/aptos-core/blob/main/crates/aptos-crypto/src/secp256k1_ecdsa.rs#L88-L96):

```rust
fn sign<T: CryptoHash + Serialize>(&self, message: &T) -> Result<Signature, _> {
    match bytes_to_message(&traits::signing_message(message)?) {
        Ok(message) => Ok(self.sign(&message)),
        ...
    }
}
```

and [`secp256k1_ecdsa.rs:296-299`](https://github.com/aptos-labs/aptos-core/blob/main/crates/aptos-crypto/src/secp256k1_ecdsa.rs#L296-L299):

```rust
fn bytes_to_message(message: &[u8]) -> Result<libsecp256k1::Message> {
    let message_digest = HashValue::sha3_256_of(message).to_vec();
    libsecp256k1::Message::parse_slice(&message_digest).map_err(|e| anyhow!("{}", e))
}
```

**Why SHA3-256?** Purely for internal consistency with the rest of `aptos-crypto`, **not** for chain compatibility. Ethereum uses Keccak-256[^eth-keccak] (different SHA-3 padding[^keccak-vs-sha3]); Bitcoin uses double-SHA-256[^btc-dsha]. We match neither.

## Appendix: What the wallet pins vs. what the dapp controls in Petra's `signMessage` flow

Recall that the signing message starts with the string literal `APTOS`, then conditionally appends `address:`, `application:`, `chainId:` lines (in that order), then always appends `message:` and `nonce:`. All separators are `\n` (not `||`).

The dapp's request to the wallet carries only:

```ts
{
  message: string,
  nonce: string,
  // opt-in inclusion flags — boolean toggles, not values:
  address?: boolean,
  application?: boolean,
  chainId?: boolean,
  // optional hint that triggers a session switch before signing,
  // not embedded in the signed message:
  network?: string,
}
```

i.e., the dapp only supplies `message`, `nonce`, and three boolean *include* flags. The wallet fills in the actual `address`, `application`, and `chainId` values itself from trusted sources.

### What's restricted vs. what the dapp controls

| Field in signed message | Source (Petra extension / mobile) | Dapp can choose value? | Example value |
|---|---|---|---|
| `address` | Wallet's connected account | <u>No</u>, only whether to include it | `0x1a2b3c...` (32-byte Aptos address) |
| `application` | The dapp's request origin / domain | <u>No</u>, only whether to include it | `my-dapp.xyz` |
| `chainId` | Wallet's currently active network | <u>No</u>, only whether to include it (the dapp can *hint* via `network?` to trigger a session switch before signing, but it cannot forge the value) | `1` (mainnet) |
| `message` | Free-form string from the dapp | **Yes** | `Welcome to dapp!` |
| `nonce` | Free-form string from the dapp | **Yes** | `1234034` (typically, randomly chosen) |

[^eth-keccak]: [EIP-155: Simple replay attack protection](https://eips.ethereum.org/EIPS/eip-155): specifies Ethereum's canonical transaction signing as ECDSA over `keccak256(rlp(nonce, gasprice, startgas, to, value, data, chainid, 0, 0))`. See also [EIP-712: Typed structured data hashing and signing](https://eips.ethereum.org/EIPS/eip-712), whose signed digest is `keccak256(0x1901 || domainSeparator || hashStruct(message))`.
[^keccak-vs-sha3]: [The Keccak team's specifications summary](https://keccak.team/keccak_specs_summary.html): Keccak-256 (Ethereum) and SHA3-256 (NIST FIPS 202) share the same underlying Keccak-*f*[1600] permutation but differ in their domain-separation suffix bits, so they produce different digests on the same input.
[^btc-dsha]: [BIP-143: Transaction Signature Verification for Version 0 Witness Program](https://github.com/bitcoin/bips/blob/master/bip-0143.mediawiki): specifies signing of the "double SHA256 of the serialization of …" the transaction preimage. The same double-SHA-256 pattern appears in legacy and Taproot signing schemes too.
[^petra-signing-a-message]: [Signing Messages ](https://petra.app/docs/signing-a-message)
[^daa-docs]: [Derivable Account Abstraction](https://aptos.dev/build/sdks/ts-sdk/account/derivable-account-abstraction): developer-facing docs for DAA in the Aptos TS SDK, including motivation and example flows.
